import { describe, expect, it } from "vitest";
import type { AdaptationDecision } from "../adaptation-decision.js";
import { assertNeverAdaptationDecision } from "../adaptation-decision.js";
import { behaviorDeltaId, invariantId } from "../ids.js";

const DELTA = behaviorDeltaId("delta-1");
const INVARIANT = invariantId("auto-refund-ceiling");
const TALLY = { deltaId: DELTA, distinctContexts: 3, helped: 3, neutral: 0, harmed: 0 };

describe("AdaptationDecision.frozen structurally excludes a tally — unsayable, not merely unchecked", () => {
  it("constructs a valid frozen decision with no tally field", () => {
    const frozen: AdaptationDecision = { kind: "frozen", deltaId: DELTA, invariant: INVARIANT };
    expect(frozen.kind).toBe("frozen");
    expect("tally" in frozen).toBe(false);
  });

  it("TYPE-LEVEL: a frozen literal carrying a tally does not compile", () => {
    const frozen: AdaptationDecision = {
      kind: "frozen",
      deltaId: DELTA,
      invariant: INVARIANT,
      // @ts-expect-error — `frozen` has no `tally` field on the type at all; citing evidence for a frozen refusal would misrepresent why it fired (plan §2).
      tally: TALLY,
    };
    expect(frozen).toBeDefined();
  });
});

describe("AdaptationDecision.hold carries a number of remaining distinct contexts, not a boolean or prose", () => {
  it("constructs a valid hold decision with a numeric distinctContextsNeeded", () => {
    const hold: AdaptationDecision = {
      kind: "hold",
      deltaId: DELTA,
      tally: TALLY,
      distinctContextsNeeded: 2,
    };
    expect(hold.distinctContextsNeeded).toBe(2);
    expect(typeof hold.distinctContextsNeeded).toBe("number");
  });

  it("TYPE-LEVEL: hold missing distinctContextsNeeded does not compile", () => {
    // @ts-expect-error — `distinctContextsNeeded: number` is required on `hold`; a decision that can't say how many more contexts are needed is a vague "not yet," which the plan refuses.
    const hold: AdaptationDecision = { kind: "hold", deltaId: DELTA, tally: TALLY };
    expect(hold).toBeDefined();
  });

  it("TYPE-LEVEL: hold with a boolean distinctContextsNeeded does not compile", () => {
    const hold: AdaptationDecision = {
      kind: "hold",
      deltaId: DELTA,
      tally: TALLY,
      // @ts-expect-error — `distinctContextsNeeded` must be a `number` a caller can act on, never a boolean standing in for "not yet."
      distinctContextsNeeded: true,
    };
    expect(hold).toBeDefined();
  });
});

describe("adopt/hold/revert must each cite the tally that licensed them", () => {
  it("TYPE-LEVEL: adopt missing tally does not compile", () => {
    // @ts-expect-error — `adopt` refuses to fire without citing the exact tally that licensed it.
    const adopt: AdaptationDecision = { kind: "adopt", deltaId: DELTA };
    expect(adopt).toBeDefined();
  });

  it("TYPE-LEVEL: revert missing tally does not compile", () => {
    // @ts-expect-error — `revert` refuses to fire without citing the exact tally that licensed it.
    const revert: AdaptationDecision = {
      kind: "revert",
      deltaId: DELTA,
      revertedTo: "conservative",
    };
    expect(revert).toBeDefined();
  });

  it("TYPE-LEVEL: revert missing revertedTo does not compile", () => {
    // @ts-expect-error — `revert` must state the value the knob rolled back to.
    const revert: AdaptationDecision = { kind: "revert", deltaId: DELTA, tally: TALLY };
    expect(revert).toBeDefined();
  });
});

/**
 * FALSIFIABILITY: `assertNeverAdaptationDecision` is a live exhaustiveness
 * guard, not decorative. Proven on a LOCAL five-kind stand-in union — never
 * by widening the real, frozen four-variant `AdaptationDecision` just to
 * make a point (same discipline `agent-control-tower`'s own
 * `intervention.test.ts` documents for `assertNeverIntervention`).
 *
 * This was actually broken and restored while writing this test: the
 * `"bogus"` case below was temporarily removed from the switch's handled
 * set (leaving only three of the four real-shaped cases plus no default),
 * `npm run typecheck` was run, and it failed with exactly the predicted
 * error — `assertNeverStandIn(decision)` no longer type-checked because
 * `decision` was narrowed to `{ kind: "bogus" }` in the unhandled branch,
 * which is not assignable to `never` (TS2345, "Argument of type '{ kind:
 * "bogus"; }' is not assignable to parameter of type 'never'."). Restoring
 * the case returned `typecheck` to clean. See this milestone's PR/report
 * for the transcript.
 */
type StandIn =
  | { kind: "adopt" }
  | { kind: "hold" }
  | { kind: "revert" }
  | { kind: "frozen" }
  | { kind: "bogus" };

function assertNeverStandIn(value: never): never {
  throw new Error(`Unreachable: ${JSON.stringify(value)}`);
}

function describeStandIn(decision: StandIn): string {
  switch (decision.kind) {
    case "adopt":
      return "adopt";
    case "hold":
      return "hold";
    case "revert":
      return "revert";
    case "frozen":
      return "frozen";
    case "bogus":
      return "bogus";
    default:
      return assertNeverStandIn(decision);
  }
}

describe("assertNeverAdaptationDecision is a live exhaustiveness guard", () => {
  it("handles every stand-in case today (mechanism proven live during development, see comment above)", () => {
    expect(describeStandIn({ kind: "adopt" })).toBe("adopt");
    expect(describeStandIn({ kind: "bogus" })).toBe("bogus");
  });

  it("the real assertNeverAdaptationDecision throws if ever reached at runtime (never expected to be, by construction)", () => {
    expect(() => assertNeverAdaptationDecision({ kind: "frozen", deltaId: DELTA, invariant: INVARIANT } as never)).toThrow(
      /Unreachable/,
    );
  });
});
