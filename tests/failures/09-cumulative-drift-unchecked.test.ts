import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { distinctContextEpisodes, VACANT } from "./helpers.js";

/**
 * ============================================================
 * CASE 9 — CUMULATIVE DRIFT ACROSS MANY SMALL ADOPTED DELTAS IS NOT
 * CHECKED (`.genesis/PLAN.md` §4, case 8 — "the riskiest disclosed gap in
 * this plan")
 * ============================================================
 * KIND: DISCLOSES THE RISKIEST UNSOLVED GAP IN THIS PROJECT'S OWN PLAN —
 * ONE MANIFESTATION OF IT, NOT THE WHOLE OF IT. SEE CASE 17 FOR THE
 * DEEPER, SIMPLER ROOT CAUSE THIS CASE DOES NOT, BY ITSELF, MAKE PLAIN.
 *
 * A FRAMING CORRECTION, MADE AFTER L4 VERIFY: this case's own original
 * framing — several small, individually-corroborated deltas accumulating
 * across a SEQUENCE — could leave a reader believing the underlying risk
 * requires an attacker's patience, walking a knob gradually over several
 * rounds. IT DOES NOT. `tests/failures/17-no-value-range-check-at-all.
 * test.ts` demonstrates the simpler root cause directly: there is no
 * value-range check on a knob AT ALL, not even on a single delta's first
 * and only proposal — a lone delta proposing `escalation-aggressiveness`
 * jump straight from 0.5 to 999,999 adopts immediately, no sequence, no
 * drift, and no prior adoption required. Read this case as ONE way that
 * deeper gap shows up (several small, plausible-looking steps compounding
 * unnoticed), not as the requirement for the gap to matter at all.
 *
 * THE GAP, STATED PLAINLY: `arbitrate` (M5, FROZEN) rules on exactly one
 * candidate delta's own tally against the CURRENT gate result and the
 * CURRENT knob occupancy (`KnobPriorState`) — it has no memory of, and
 * performs no check against, how many deltas have already adopted on this
 * knob before, or how far the knob's live value has already walked from
 * its original baseline. `.genesis/decisions/0005-arbitration.md` Decision
 * 3 names this directly: "Nothing in `KnobPriorState` or in `arbitrate`'s
 * own logic inspects how far a knob's live value has already walked from
 * any original baseline."
 *
 * THE CONCRETE CONSEQUENCE THIS CASE DEMONSTRATES, NOT MERELY ASSERTED:
 * three SEPARATE, each individually well-corroborated (3 distinct helped
 * contexts apiece — comfortably clearing MIN_DISTINCT_CONTEXTS_ADOPT every
 * single time) deltas, each superseding the previous live value on
 * `escalation-aggressiveness`, walk the knob from its documented [0, 1]
 * range all the way to 3.4 — a value `domains/support-triage/knobs.ts`'s
 * own header describes as a bounded float in [0, 1] and which no runtime
 * check anywhere in this codebase rejects. Nothing about any INDIVIDUAL
 * step is unusual or under-evidenced; this case's own point is that the
 * SEQUENCE as a whole is unchecked — while case 17's point is that no
 * single step is checked EITHER, sequence or not.
 *
 * WHY THIS IS NOT THIS MILESTONE'S TO FIX: `.genesis/PLAN.md` §4 case 8
 * itself states "building real cumulative-bound tracking is a materially
 * bigger engine than a hackathon M3–M5 budget supports" — this case exists
 * to demonstrate the gap is real and reachable through the real pipeline,
 * not to build the tracking engine the plan explicitly declines to build.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED): a
 * future `arbitrate` (or a wrapping layer) refusing to adopt a delta whose
 * knob value, cumulatively, has moved more than some bound from an
 * original baseline — at which point the fourth `adopt` below would need
 * to become a `hold` or be refused some other way.
 */
describe("CASE 9 (DISCLOSES, riskiest): a knob's value drifts arbitrarily far across a sequence of individually well-corroborated adoptions", () => {
  it("three sequential adopted deltas, each independently corroborated, walk escalation-aggressiveness from within [0, 1] to 3.4 — no step is refused, and nothing inspects the sequence", () => {
    const step1 = proposeDelta({
      id: "failure-case-9-step-1",
      knob: "escalation-aggressiveness",
      from: 0.5,
      to: 1.2,
      proposedAt: "2026-01-01T00:00:00Z",
    });
    const step2 = proposeDelta({
      id: "failure-case-9-step-2",
      knob: "escalation-aggressiveness",
      from: 1.2,
      to: 2.3,
      proposedAt: "2026-02-01T00:00:00Z",
    });
    const step3 = proposeDelta({
      id: "failure-case-9-step-3",
      knob: "escalation-aggressiveness",
      from: 2.3,
      to: 3.4,
      proposedAt: "2026-03-01T00:00:00Z",
    });

    // Step 1: adopts from vacant, 3 distinct helped contexts.
    const result1 = evaluateDelta(step1, distinctContextEpisodes(step1.id, "tck-drift-1", "helped", 3), VACANT);
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;
    expect(result1.decision.kind).toBe("adopt");

    // Step 2: a real caller must first resolve step1's own occupancy to
    // "vacant" (superseded by step2) before proposing step2 as the new
    // candidate — arbitrate only ever sees ONE delta's priorState per
    // call, by design (0005-arbitration.md Decision 3), and has no memory
    // of step1 having ever existed once this handoff happens. This is
    // exactly the "no history" gap this case pins: the handoff itself is
    // this domain's own, entirely unchecked, responsibility to sequence
    // correctly.
    const result2 = evaluateDelta(step2, distinctContextEpisodes(step2.id, "tck-drift-2", "helped", 3), {
      kind: "vacant",
    });
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    expect(result2.decision.kind).toBe("adopt");

    // Step 3: same pattern, superseding step2.
    const result3 = evaluateDelta(step3, distinctContextEpisodes(step3.id, "tck-drift-3", "helped", 3), {
      kind: "vacant",
    });
    expect(result3.ok).toBe(true);
    if (!result3.ok) return;
    expect(result3.decision.kind).toBe("adopt");

    // THE CONSEQUENCE: the knob's own live value, after three individually
    // well-corroborated adoptions, is 3.4 — well outside the [0, 1] range
    // this domain's own documentation describes for this knob, and no
    // function anywhere in lib/arbitrate or lib/invariants ever compared
    // step3.to against step1.from (the ORIGINAL baseline) at all.
    expect(step3.to).toBe(3.4);
    expect(step3.to).toBeGreaterThan(1);
    expect(step1.from).toBe(0.5);
    // The total drift across the sequence (2.9) vastly exceeds any single
    // step's own, individually modest, delta (0.7-1.1) — confirming this
    // is genuinely a SEQUENCE property, not visible from any one decision.
    const totalDrift = step3.to - step1.from;
    const largestSingleStep = Math.max(step1.to - step1.from, step2.to - step2.from, step3.to - step3.from);
    expect(totalDrift).toBeGreaterThan(largestSingleStep * 2);
  });

  it("CONTROL, confirming arbitrate really does rule on each step independently and would happily rule on a FOURTH step continuing the same drift, with no signal anywhere that three prior adoptions already occurred", () => {
    const farFromBaseline = proposeDelta({
      id: "failure-case-9-step-4",
      knob: "escalation-aggressiveness",
      from: 3.4,
      to: 4.5,
      proposedAt: "2026-04-01T00:00:00Z",
    });
    const result = evaluateDelta(farFromBaseline, distinctContextEpisodes(farFromBaseline.id, "tck-drift-4", "helped", 3), VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Resolves adopt exactly as readily as step 1 did, starting from 0.5 —
    // arbitrate has no way to tell these two calls apart as "early in a
    // sequence" vs. "the fourth consecutive drift step."
    expect(result.decision.kind).toBe("adopt");
  });
});
