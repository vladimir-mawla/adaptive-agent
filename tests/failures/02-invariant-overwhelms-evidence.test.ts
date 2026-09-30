import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { REFUND_CEILING_DELTA } from "../../domains/support-triage/scenario.js";
import { distinctContextEpisodes, VACANT } from "./helpers.js";

/**
 * ============================================================
 * CASE 2 — INVARIANT-TARGETING DELTA WITH OVERWHELMING EVIDENCE
 * (`.genesis/PLAN.md` §4, case 2) — folds in sketch case 10 (malformed/
 * hand-built delta bypassing normal proposal flow)
 * ============================================================
 * KIND: PROVES A REFUSAL HOLDS.
 *
 * THE CLAIM PINNED: 10,000 synthetic "helped" episodes, spread across
 * 10,000 genuinely DISTINCT contexts (not a replay storm — the maximally
 * corroborated shape this project's own vocabulary can produce) against a
 * delta targeting `auto-refund-ceiling` still resolves `frozen`. Traces to
 * M4 (`gate`'s structural evidence-blindness) and M5 (`frozen` wins over
 * everything, checked first, unconditionally). `lib/invariants/
 * __tests__/immunity.test.ts` already proves this at the `gate()` call
 * alone, at this exact scale; this case re-proves it through the FULL
 * pipeline (`tally -> gate -> arbitrate`, via this domain's real
 * `evaluateDelta`), which `immunity.test.ts` does not exercise.
 *
 * ALSO FOLDS IN PLAN §4 CASE 10 ("malformed BehaviorDelta reaching
 * arbitrate directly, bypassing normal proposal flow"): `REFUND_CEILING_
 * DELTA` (`domains/support-triage/scenario.ts`) is built as a raw object
 * literal, never through `knobs.ts`'s `proposeDelta` (whose own parameter
 * type cannot name `auto-refund-ceiling` at all — see that file's
 * header). The claim pinned here is broader than "the sanctioned entry
 * point refuses this knob" — it is "however the delta was constructed,
 * `gate` matches on the RUNTIME `knob` string, not on provenance," so a
 * delta built by any means whatsoever, naming the protected knob, is
 * frozen.
 *
 * WHAT WOULD MAKE THIS FAIL: `gate`'s matching predicate
 * (`invariant.knob === delta.knob`) being made conditional on evidence
 * volume, or the `frozen`-wins check in `arbitrate` being reordered behind
 * the tally comparison. Proven for real below.
 */
describe("CASE 2 (PROVES): an invariant-protected knob stays frozen no matter how much evidence a hand-built delta accumulates", () => {
  it("10,000 distinct-context, all-helped episodes against the hand-built auto-refund-ceiling delta still resolve frozen, through the full evaluateDelta pipeline", () => {
    const overwhelming = distinctContextEpisodes(REFUND_CEILING_DELTA.id, "tck-overwhelm", "helped", 10_000);
    const result = evaluateDelta(REFUND_CEILING_DELTA, overwhelming, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("frozen");
    expect(result.decision.kind === "frozen" && result.decision.invariant).toBe("inv-auto-refund-ceiling");
  });

  it("CONTROL, proving frozen is not merely 'no evidence was attached': the IDENTICAL 10,000-episode shape, re-keyed to an ADAPTABLE knob's own delta, genuinely adopts", () => {
    const adaptableDelta = proposeDelta({
      id: "failure-case-2-control",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.9,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const overwhelming = distinctContextEpisodes(adaptableDelta.id, "tck-overwhelm-control", "helped", 10_000);
    const result = evaluateDelta(adaptableDelta, overwhelming, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
  });

  it("zero evidence and 10,000 episodes of overwhelming evidence produce the IDENTICAL frozen decision for the protected knob — evidence quantity is not merely outweighed, it is never consulted at all", () => {
    const withoutEvidence = evaluateDelta(REFUND_CEILING_DELTA, [], VACANT);
    const withEvidence = evaluateDelta(
      REFUND_CEILING_DELTA,
      distinctContextEpisodes(REFUND_CEILING_DELTA.id, "tck-overwhelm-2", "helped", 10_000),
      VACANT,
    );
    expect(withoutEvidence.ok).toBe(true);
    expect(withEvidence.ok).toBe(true);
    if (!withoutEvidence.ok || !withEvidence.ok) return;
    expect(withEvidence.decision).toEqual(withoutEvidence.decision);
  });
});
