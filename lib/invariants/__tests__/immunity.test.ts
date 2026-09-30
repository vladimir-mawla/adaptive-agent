import { describe, expect, it } from "vitest";
import { behaviorDeltaId, contextId, invariantId, timestamp } from "../../contracts/index.js";
import type { BehaviorDelta, Episode, Invariant } from "../../contracts/index.js";
import { tally } from "../../evidence/tally.js";
import { createInvariantRegistry, gate } from "../gate.js";

/**
 * "A THOUSAND CORROBORATING EPISODES ACROSS A THOUSAND CONTEXTS MUST NOT
 * MOVE IT" — this file is the one place in this milestone that actually
 * builds a real, large `EvidenceTally` (via `lib/evidence`'s already-built,
 * FROZEN `tally()`) and puts it in the same test as `gate`, specifically so
 * the immunity claim rests on more than reading `gate`'s own signature.
 *
 * WHY THIS FILE IMPORTS `lib/evidence`, AND WHY THAT IS SAFE FOR THE
 * MODULAR-ARCHITECTURE GATE (`.genesis/DONE.html` §2: "Dependency direction
 * inward, zero cycles: `lib/contracts` → `lib/evidence` and
 * `lib/invariants` → `lib/arbitrate` ..."): that gate is about
 * NON-TEST SOURCE — `lib/invariants/gate.ts` itself imports nothing from
 * `lib/evidence` (confirmed directly by `__tests__/architecture.test.ts`'s
 * own import scan, not merely by inspection here). This TEST file, by
 * contrast, is free to reach across sibling layers the way a project's own
 * integration proof always must — `lib/evidence` and `lib/invariants` are
 * declared PARALLEL siblings of `lib/contracts`, not one depending on the
 * other's production code, and nothing here creates a cycle: `lib/evidence`
 * still imports nothing from `lib/invariants`.
 */
type KnobId = "auto-refund-ceiling" | "escalation-aggressiveness";

function frozenInvariant(): Invariant<KnobId> {
  return { id: invariantId("refund-ceiling-invariant"), knob: "auto-refund-ceiling", description: "never adaptable" };
}

function delta(knob: KnobId): BehaviorDelta<KnobId, number> {
  return {
    id: behaviorDeltaId(`delta-${knob}`),
    knob,
    from: 500,
    to: 5000,
    proposedAt: timestamp("2026-09-30T00:00:00Z"),
  };
}

function buildHelpedEpisodeStorm(deltaId: ReturnType<typeof behaviorDeltaId>, count: number): Episode[] {
  const episodes: Episode[] = [];
  for (let i = 0; i < count; i += 1) {
    episodes.push({
      deltaId,
      // One DISTINCT context per episode (not a replay storm) — this is
      // the maximally corroborated shape the plan itself names as the one
      // that must still not move a frozen knob: "regardless of how much or
      // how corroborated the evidence is."
      contextId: contextId(`context-${i}`),
      outcome: "helped",
      observedAt: timestamp("2026-09-30T00:00:00Z"),
    });
  }
  return episodes;
}

describe("gate is immune to evidence volume — proven with a real, large, genuinely-corroborated tally, not an assertion about the signature alone", () => {
  it("10,000 'helped' episodes across 10,000 DISTINCT contexts still resolves 'frozen' for an invariant-protected knob", () => {
    const targetDelta = delta("auto-refund-ceiling");
    const episodes = buildHelpedEpisodeStorm(targetDelta.id, 10_000);

    const tallyResult = tally(targetDelta.id, episodes);
    expect(tallyResult.ok).toBe(true);
    if (!tallyResult.ok) throw new Error("unreachable — asserted ok above");

    // Confirm this is genuinely overwhelming evidence, not a weak case that
    // happens to pass — comfortably clears ANY corroboration bar M5 could
    // plausibly set (plan §3 M5 names MIN_DISTINCT_CONTEXTS_ADOPT = 3).
    expect(tallyResult.tally.distinctContexts).toBe(10_000);
    expect(tallyResult.tally.helped).toBe(10_000);
    expect(tallyResult.tally.neutral).toBe(0);
    expect(tallyResult.tally.harmed).toBe(0);

    const registry = createInvariantRegistry([frozenInvariant()]);

    // THE POINT: gate's signature has no parameter to receive
    // `tallyResult.tally` through — it is computed above, real, in scope,
    // and irrelevant, not merely unused.
    const decision = gate(targetDelta, registry);
    expect(decision).toBe("frozen");
  });

  it("the same 10,000-episode tally against a NON-invariant-protected knob would have cleared any bar — confirming the storm itself is not the reason gate refuses", () => {
    const eligibleDelta = delta("escalation-aggressiveness");
    const episodes = buildHelpedEpisodeStorm(eligibleDelta.id, 10_000);
    const tallyResult = tally(eligibleDelta.id, episodes);
    expect(tallyResult.ok).toBe(true);

    const registry = createInvariantRegistry([frozenInvariant()]); // protects a DIFFERENT knob
    expect(gate(eligibleDelta, registry)).toBe("eligible");
  });

  it("zero episodes also resolves 'frozen' for the same knob — confirms the answer does not depend on evidence being absent OR overwhelming, it never depends on evidence at all", () => {
    const targetDelta = delta("auto-refund-ceiling");
    const tallyResult = tally(targetDelta.id, []);
    expect(tallyResult.ok).toBe(true);
    if (tallyResult.ok) expect(tallyResult.tally.distinctContexts).toBe(0);

    const registry = createInvariantRegistry([frozenInvariant()]);
    expect(gate(targetDelta, registry)).toBe("frozen");
  });
});
