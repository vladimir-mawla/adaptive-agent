import { describe, expect, it } from "vitest";
import { arbitrate } from "../arbitrate.js";
import { MIN_DISTINCT_CONTEXTS_ADOPT, MIN_DISTINCT_CONTEXTS_REVERT } from "../policy-constants.js";
import { EMPTY_REGISTRY, makeDelta, makeTally } from "./fixtures.js";

/**
 * THE ASYMMETRY, PROVEN DIRECTLY: the SAME tally shape — same
 * `distinctContexts` count, same total episode count — is read
 * DIFFERENTLY depending on whether the delta in question is a
 * not-yet-adopted candidate (judged against the higher ADOPT bar) or an
 * already-live delta under post-adoption monitoring (judged against the
 * lower REVERT bar). If `MIN_DISTINCT_CONTEXTS_ADOPT` and
 * `MIN_DISTINCT_CONTEXTS_REVERT` were equal, or if `arbitrate` secretly
 * used the same threshold for both branches regardless of the exported
 * constants, this test would fail — it does not merely assert the two
 * constants are unequal (`policy-constants.ts` already documents that),
 * it asserts `arbitrate`'s actual OUTPUT differs at the identical input
 * shape.
 */
describe("the adopt/revert asymmetry: the SAME tally shape produces different outcomes depending on which bar applies", () => {
  it("MIN_DISTINCT_CONTEXTS_REVERT < MIN_DISTINCT_CONTEXTS_ADOPT (the asymmetry is real, not a naming coincidence)", () => {
    expect(MIN_DISTINCT_CONTEXTS_REVERT).toBeLessThan(MIN_DISTINCT_CONTEXTS_ADOPT);
  });

  it("distinctContexts === MIN_DISTINCT_CONTEXTS_REVERT clears the revert bar for a live delta, but the identical count, with a helped-majority instead, does NOT clear the adopt bar for a not-yet-adopted candidate", () => {
    const N = MIN_DISTINCT_CONTEXTS_REVERT;
    expect(N).toBeLessThan(MIN_DISTINCT_CONTEXTS_ADOPT); // precondition for this test to mean anything

    const liveDelta = makeDelta("live", "escalation-aggressiveness", 0.3, 0.5);
    const harmedTally = makeTally(liveDelta.id, { distinctContexts: N, helped: 0, neutral: 0, harmed: N });
    const revertDecision = arbitrate(
      liveDelta,
      harmedTally,
      "eligible",
      { kind: "live", liveDeltaId: liveDelta.id, replacedValue: 0.3 },
      EMPTY_REGISTRY,
    );
    expect(revertDecision.kind).toBe("revert");

    const candidateDelta = makeDelta("candidate", "response-directness", 0.2, 0.4);
    const helpedTally = makeTally(candidateDelta.id, { distinctContexts: N, helped: N, neutral: 0, harmed: 0 });
    const adoptDecision = arbitrate(candidateDelta, helpedTally, "eligible", { kind: "vacant" }, EMPTY_REGISTRY);
    expect(adoptDecision.kind).toBe("hold"); // N < MIN_DISTINCT_CONTEXTS_ADOPT, so adoption is NOT licensed at the same N that already licenses a revert
  });

  it("a single post-adoption harmed episode is enough to be AT the revert-context-floor when N happens to equal 1 only if MIN_DISTINCT_CONTEXTS_REVERT were 1 — pinned instead at its real value: one harmed episode alone (distinctContexts: 1) never reverts, confirming the revert bar, though lower than adopt's, is still not zero", () => {
    const liveDelta = makeDelta("live", "escalation-aggressiveness", 0.3, 0.5);
    const oneHarmed = makeTally(liveDelta.id, { distinctContexts: 1, helped: 0, neutral: 0, harmed: 1 });
    const decision = arbitrate(
      liveDelta,
      oneHarmed,
      "eligible",
      { kind: "live", liveDeltaId: liveDelta.id, replacedValue: 0.3 },
      EMPTY_REGISTRY,
    );
    expect(decision.kind).toBe("adopt"); // continued adopt, not revert — the bar is lower than adopt's, not absent
  });
});
