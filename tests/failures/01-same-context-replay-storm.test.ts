import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { distinctContextEpisodes, sameContextStorm, VACANT } from "./helpers.js";

/**
 * ============================================================
 * CASE 1 — SAME-CONTEXT REPLAY STORM (`.genesis/PLAN.md` §4, case 1)
 * ============================================================
 * KIND: PROVES A REFUSAL HOLDS.
 *
 * THE CLAIM PINNED: one ticket's complaint, resubmitted or retried any
 * number of times, must yield `distinctContexts: 1` and therefore never
 * ALONE reach `adopt` — no matter how many times it repeats, and no
 * matter how enthusiastically every repeat says "helped." Traces to M3's
 * own core refusal (`lib/evidence/tally.ts`: "a delta with 200 episodes,
 * all from the same `contextId`, has `distinctContexts: 1`") exercised
 * here through the FULL pipeline (`tally` -> `gate` -> `arbitrate`, via
 * this domain's real `evaluateDelta`), not only at `lib/evidence`'s own
 * unit level, which already proves the same fact in isolation
 * (`lib/evidence/__tests__/tally.test.ts`'s 50/500-episode storms).
 *
 * WHAT WOULD MAKE THIS FAIL: `lib/evidence/tally.ts`'s dedup mechanism
 * (`new Set(...).size`) regressing to counting episodes instead of unique
 * contexts (e.g. `values.length`) — the exact sabotage
 * `.genesis/decisions/0003-evidence.md` Decision 2's own falsifiability
 * log already ran and reverted for `lib/evidence`'s own suite. Proven
 * for real below, against `lib/evidence/tally.ts` as it ships today,
 * not merely asserted from that ADR's own account.
 */
describe("CASE 1 (PROVES): a same-context replay storm never reaches adopt on its own", () => {
  it("500 identical-context 'helped' replays resolve hold, with distinctContexts: 1 and the full shortfall still outstanding", () => {
    const delta = proposeDelta({
      id: "failure-case-1-delta",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.9,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const storm = sameContextStorm(delta.id, "tck-storm-1", "helped", 500);
    const result = evaluateDelta(delta, storm, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    expect(result.decision.kind === "hold" && result.decision.tally.distinctContexts).toBe(1);
    // MIN_DISTINCT_CONTEXTS_ADOPT is 3 (lib/arbitrate/policy-constants.ts) — 1 distinct
    // context is 2 short, regardless of how many of the 500 replays "helped."
    expect(result.decision.kind === "hold" && result.decision.distinctContextsNeeded).toBe(2);
  });

  it("scaling the SAME storm to 5,000 replays changes nothing about the count — this is a structural refusal, not a threshold the attacker merely has to clear with more volume", () => {
    const delta = proposeDelta({
      id: "failure-case-1-delta-b",
      knob: "response-directness",
      from: 0.3,
      to: 0.7,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const storm = sameContextStorm(delta.id, "tck-storm-2", "helped", 5000);
    const result = evaluateDelta(delta, storm, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    expect(result.decision.kind === "hold" && result.decision.tally.distinctContexts).toBe(1);
    expect(result.decision.kind === "hold" && result.decision.tally.helped).toBe(5000);
  });

  it("CONTROL, proving this is refused for lack of DISTINCT contexts specifically, not merely 'too many episodes': the identical count (3) of genuinely distinct contexts, all helped, DOES adopt", () => {
    const delta = proposeDelta({
      id: "failure-case-1-control",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.9,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const genuinelyDistinct = distinctContextEpisodes(delta.id, "tck-real", "helped", 3);
    const result = evaluateDelta(delta, genuinelyDistinct, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
  });
});
