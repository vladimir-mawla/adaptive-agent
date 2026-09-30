import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { distinctContextEpisodes, liveState } from "./helpers.js";

/**
 * ============================================================
 * CASE 4 — TWO DELTAS RACING THE SAME KNOB (`.genesis/PLAN.md` §4, case 4)
 * ============================================================
 * KIND: PROVES A REFUSAL HOLDS.
 *
 * THE CLAIM PINNED: a second delta proposed against an already-adopted
 * knob, before the first is reverted, resolves `hold` — never a silent
 * second `adopt` overwriting the first — REGARDLESS OF HOW STRONG THE
 * SECOND DELTA'S OWN EVIDENCE IS. Traces to M5's "at most one live delta
 * per knob" refusal (`lib/arbitrate/arbitrate.ts`'s `priorState.kind ===
 * "live"` branch, checked before the candidate's own tally is even
 * consulted). `lib/arbitrate/__tests__/knob-contention.test.ts` already
 * proves this against synthetic fixtures; this case re-proves it through
 * the full pipeline with a rival delta this domain's own `proposeDelta`
 * built, not a hand-rolled fixture object.
 *
 * WHAT WOULD MAKE THIS FAIL: `arbitrate`'s `priorState.kind === "live"`
 * branch being reordered to check the rival's own tally before checking
 * whether `liveDeltaId === delta.id`. Proven for real below with a rival
 * whose own evidence, alone, would clear the adopt bar outright.
 */
describe("CASE 4 (PROVES): a second delta racing an already-occupied knob is held, no matter how strong its own evidence is", () => {
  it("a rival delta with 50 distinct helped contexts (comfortably clearing MIN_DISTINCT_CONTEXTS_ADOPT) is still held while a DIFFERENT delta occupies the knob", () => {
    const liveDelta = proposeDelta({
      id: "failure-case-4-live",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.6,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const rival = proposeDelta({
      id: "failure-case-4-rival",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.95,
      proposedAt: "2026-03-05T00:00:00Z",
    });
    const liveOccupied = liveState(liveDelta.id, 0.4);
    const overwhelmingOwnEvidence = distinctContextEpisodes(rival.id, "tck-rival", "helped", 50);

    const result = evaluateDelta(rival, overwhelmingOwnEvidence, liveOccupied);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    // Pinned on the real tally too — the only thing holding this delta back
    // is contention, not weak evidence (see case 12 for the distinctContextsNeeded: 0 consequence).
    expect(result.decision.kind === "hold" && result.decision.tally.distinctContexts).toBe(50);
    expect(result.decision.kind === "hold" && result.decision.tally.helped).toBe(50);
  });

  it("CONTROL, proving the rival really would have adopted on an unoccupied knob: the identical rival delta/evidence resolves adopt when the knob is vacant", () => {
    const rival = proposeDelta({
      id: "failure-case-4-control",
      knob: "response-directness",
      from: 0.3,
      to: 0.8,
      proposedAt: "2026-03-05T00:00:00Z",
    });
    const overwhelmingOwnEvidence = distinctContextEpisodes(rival.id, "tck-rival-control", "helped", 50);
    const result = evaluateDelta(rival, overwhelmingOwnEvidence, { kind: "vacant" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
  });
});
