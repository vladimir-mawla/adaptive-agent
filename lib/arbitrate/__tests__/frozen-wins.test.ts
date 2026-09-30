import { describe, expect, it } from "vitest";
import { contextId, timestamp } from "../../contracts/index.js";
import type { Episode } from "../../contracts/index.js";
import { tally } from "../../evidence/tally.js";
import { arbitrate } from "../arbitrate.js";
import { makeDelta, oneInvariant, registryWith } from "./fixtures.js";

/**
 * "`frozen` wins over everything" (this milestone's own scope line) —
 * proven the same way `lib/invariants/__tests__/immunity.test.ts` proves
 * `gate`'s own immunity: a REAL, large `EvidenceTally`, computed by
 * `lib/evidence`'s already-built, FROZEN `tally()` from 10,000 genuinely
 * distinct-context `"helped"` episodes — comfortably clearing
 * MIN_DISTINCT_CONTEXTS_ADOPT by three orders of magnitude — fed into
 * `arbitrate` alongside a `gateResult` of `"frozen"`, and a `priorState`
 * that would ALSO independently license `adopt` if it were consulted
 * (`"vacant"`). If evidence volume, or a favorable prior state, could ever
 * change the outcome, it would show up here; it does not.
 */
function buildHelpedEpisodeStorm(deltaId: ReturnType<typeof makeDelta>["id"], count: number): Episode[] {
  const episodes: Episode[] = [];
  for (let i = 0; i < count; i += 1) {
    episodes.push({
      deltaId,
      contextId: contextId(`context-${i}`),
      outcome: "helped",
      observedAt: timestamp("2026-09-30T00:00:00Z"),
    });
  }
  return episodes;
}

describe("frozen wins over everything — unconditionally, regardless of tally size or prior state", () => {
  it("10,000 helped episodes across 10,000 distinct contexts, plus a vacant (adopt-eligible) prior state, still resolves 'frozen'", () => {
    const delta = makeDelta("d1", "auto-refund-ceiling", 500, 5000);
    const episodes = buildHelpedEpisodeStorm(delta.id, 10_000);
    const tallyResult = tally(delta.id, episodes);
    expect(tallyResult.ok).toBe(true);
    if (!tallyResult.ok) throw new Error("unreachable — asserted ok above");
    expect(tallyResult.tally.distinctContexts).toBe(10_000);

    const registry = registryWith(oneInvariant("auto-refund-ceiling"));
    const decision = arbitrate(delta, tallyResult.tally, "frozen", { kind: "vacant" }, registry);

    expect(decision.kind).toBe("frozen");
    if (decision.kind === "frozen") {
      expect(decision.deltaId).toBe(delta.id);
      // The FrozenDecision type itself has no tally/distinctContextsNeeded/
      // revertedTo slot (M1, FROZEN) — there is nothing further to assert
      // "wasn't leaked," the type already refuses it; this assertion
      // documents that fact rather than re-testing M1's own frozen file.
    }
  });

  it("the SAME 10,000-episode storm against a knob that is currently live for a DIFFERENT delta (which would otherwise force 'hold') still resolves 'frozen', not 'hold' — frozen is checked first, unconditionally", () => {
    const delta = makeDelta("d1", "auto-refund-ceiling", 500, 5000);
    const episodes = buildHelpedEpisodeStorm(delta.id, 10_000);
    const tallyResult = tally(delta.id, episodes);
    expect(tallyResult.ok).toBe(true);
    if (!tallyResult.ok) throw new Error("unreachable — asserted ok above");

    const registry = registryWith(oneInvariant("auto-refund-ceiling"));
    const decision = arbitrate(
      delta,
      tallyResult.tally,
      "frozen",
      { kind: "live", liveDeltaId: makeDelta("rival", "auto-refund-ceiling", 1, 2).id, replacedValue: 500 },
      registry,
    );
    expect(decision.kind).toBe("frozen");
  });

  it("zero episodes against the same invariant-protected knob also resolves 'frozen' — not because evidence is absent, but because it is never consulted", () => {
    const delta = makeDelta("d1", "auto-refund-ceiling", 500, 5000);
    const tallyResult = tally(delta.id, []);
    expect(tallyResult.ok).toBe(true);
    if (!tallyResult.ok) throw new Error("unreachable — asserted ok above");

    const registry = registryWith(oneInvariant("auto-refund-ceiling"));
    const decision = arbitrate(delta, tallyResult.tally, "frozen", { kind: "vacant" }, registry);
    expect(decision.kind).toBe("frozen");
  });

  it("names the correct InvariantId from a multi-invariant registry, not merely the first entry", () => {
    const delta = makeDelta("d1", "auto-refund-ceiling", 500, 5000);
    const registry = registryWith(oneInvariant("response-directness", "i1"), oneInvariant("auto-refund-ceiling", "i2"));
    const tallyResult = tally(delta.id, []);
    if (!tallyResult.ok) throw new Error("unreachable");
    const decision = arbitrate(delta, tallyResult.tally, "frozen", { kind: "vacant" }, registry);
    expect(decision.kind).toBe("frozen");
    if (decision.kind === "frozen") expect(decision.invariant).toBe("i2");
  });
});
