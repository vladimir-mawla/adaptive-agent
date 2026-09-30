import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { distinctContextEpisodes } from "./helpers.js";
import type { KnobPriorState } from "../../lib/arbitrate/arbitrate.js";

/**
 * ============================================================
 * CASE 10 — REVERT'S ROLLBACK TARGET WHEN MORE THAN ONE DELTA HAS ADOPTED
 * SINCE BASELINE (`.genesis/PLAN.md` §4, case 9), REFINED TO PIN THE REAL
 * LIMIT: arbitrate has no way to verify the "immediately prior value" a
 * caller hands it is actually correct
 * ============================================================
 * KIND: DISCLOSES A REAL, UNSOLVED TRUST-BOUNDARY GAP.
 *
 * WHY THE PLAN'S OWN SKETCH OF THIS CASE, TAKEN LITERALLY, WOULD BE A
 * REGRESSION TEST WEARING A FAILURE'S CLOTHES: "construct two sequential
 * adoptions and revert the second, landing on the first adopted value, not
 * the baseline" is already exactly what happens when the CALLER correctly
 * tracks and supplies `priorState.replacedValue` — `arbitrate` simply
 * returns whatever `replacedValue` it was given (see `arbitrate.ts`'s own
 * `revert` branch: `revertedTo: priorState.replacedValue`, no computation
 * at all). Testing only the case where the caller gets it right would pass
 * because the system does the ONE thing asked of it, not because any
 * refusal is being exercised — the trap this account was warned about.
 *
 * THE REAL LIMIT THIS CASE PINS INSTEAD: `.genesis/decisions/
 * 0005-arbitration.md` Decision 3 states this plainly — "it is the
 * CALLER's own obligation to track and hand back the correct immediate
 * predecessor here" (not `arbitrate`'s). `arbitrate` performs NO check
 * that `priorState.replacedValue` is actually the delta's own true
 * immediate predecessor — it has no adoption history to check it against.
 * A caller bug that hands back the WRONG value (e.g., the original
 * baseline, skipping past an intermediate adoption) is not merely
 * "possible" in the abstract — it produces a wrong `revertedTo` in the
 * RETURNED `AdaptationDecision`, silently, with no error, no typed
 * failure, nothing.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED):
 * `arbitrate` gaining a real adoption-history parameter it could check
 * `replacedValue` against, and refusing or correcting an inconsistent one
 * — at which point the buggy-caller scenario below would no longer
 * silently produce a wrong `revertedTo`.
 */
describe("CASE 10 (DISCLOSES): arbitrate blindly trusts whatever 'immediately prior value' a caller hands it", () => {
  it("a correctly-tracking caller reverts to the true immediate predecessor (0.8), not the original baseline (0.5) — the ordinary, working case, established as the control", () => {
    const deltaA = proposeDelta({
      id: "failure-case-10-delta-a",
      knob: "escalation-aggressiveness",
      from: 0.5,
      to: 0.8,
      proposedAt: "2026-01-01T00:00:00Z",
    });
    const deltaB = proposeDelta({
      id: "failure-case-10-delta-b",
      knob: "escalation-aggressiveness",
      from: 0.8,
      to: 0.95,
      proposedAt: "2026-02-01T00:00:00Z",
    });

    // deltaA adopts (from vacant), then deltaB adopts (superseding deltaA).
    const resultA = evaluateDelta(deltaA, distinctContextEpisodes(deltaA.id, "tck-10a", "helped", 3), { kind: "vacant" });
    expect(resultA.ok && resultA.decision.kind === "adopt").toBe(true);
    const resultB = evaluateDelta(deltaB, distinctContextEpisodes(deltaB.id, "tck-10b", "helped", 3), { kind: "vacant" });
    expect(resultB.ok && resultB.decision.kind === "adopt").toBe(true);

    // deltaB is now live, replacing deltaA's own adopted value (0.8) — the
    // CORRECT priorState a diligent caller would track.
    const correctPriorState: KnobPriorState<number> = { kind: "live", liveDeltaId: deltaB.id, replacedValue: 0.8 };
    const revertHarmed = distinctContextEpisodes(deltaB.id, "tck-10-harm", "harmed", 2);
    const revertResult = evaluateDelta(deltaB, revertHarmed, correctPriorState);
    expect(revertResult.ok).toBe(true);
    if (!revertResult.ok) return;
    expect(revertResult.decision.kind).toBe("revert");
    expect(revertResult.decision.kind === "revert" && revertResult.decision.revertedTo).toBe(0.8);
  });

  it("THE GAP: a buggy caller that hands back the ORIGINAL baseline (0.5) instead of the true immediate predecessor (0.8) gets that wrong value back, verbatim, with no error and no typed failure of any kind", () => {
    const deltaB = proposeDelta({
      id: "failure-case-10-delta-b-buggy",
      knob: "escalation-aggressiveness",
      from: 0.8,
      to: 0.95,
      proposedAt: "2026-02-01T00:00:00Z",
    });

    // A caller bug: this domain's own scenario.ts documents that tracking
    // the correct "immediately prior" value across a chain is the
    // CALLER's job, never arbitrate's (0005-arbitration.md Decision 3) —
    // this priorState simulates exactly the caller mistake that job
    // description warns is possible: reporting 0.5 (the ORIGINAL
    // baseline, skipping past deltaA's own real intermediate value of 0.8)
    // as if it were the immediate predecessor.
    const buggyPriorState: KnobPriorState<number> = { kind: "live", liveDeltaId: deltaB.id, replacedValue: 0.5 };
    const revertHarmed = distinctContextEpisodes(deltaB.id, "tck-10-buggy-harm", "harmed", 2);

    const revertResult = evaluateDelta(deltaB, revertHarmed, buggyPriorState);
    expect(revertResult.ok).toBe(true);
    if (!revertResult.ok) return;
    expect(revertResult.decision.kind).toBe("revert");
    // THE POINT: arbitrate returns the WRONG value (0.5) exactly as
    // confidently as it would return the right one — nothing in its own
    // logic distinguishes "caller reported the truth" from "caller
    // reported a plausible-looking lie." There is no field, no warning,
    // no lower-confidence marker anywhere on the returned decision.
    expect(revertResult.decision.kind === "revert" && revertResult.decision.revertedTo).toBe(0.5);
  });
});
