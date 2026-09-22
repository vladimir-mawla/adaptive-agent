import { describe, expect, it } from "vitest";
import type { Invariant } from "../invariant.js";
import { invariantId } from "../ids.js";

const ID = invariantId("auto-refund-ceiling-invariant");

type StandInKnobId = "escalation-aggressiveness" | "auto-refund-ceiling";

describe("Invariant.knob refuses a knob name outside a domain's own narrowed KnobId union", () => {
  it("constructs a valid invariant naming a member of the local stand-in union", () => {
    const inv: Invariant<StandInKnobId> = {
      id: ID,
      knob: "auto-refund-ceiling",
      description: "The dollar ceiling above which a refund requires human approval may never be raised or lowered by the agent.",
    };
    expect(inv.knob).toBe("auto-refund-ceiling");
  });

  it("TYPE-LEVEL: a knob name outside the narrowed union does not compile", () => {
    const inv: Invariant<StandInKnobId> = {
      id: ID,
      // @ts-expect-error — "response-directness" is not a member of the local StandInKnobId union.
      knob: "response-directness",
      description: "irrelevant to this proof",
    };
    expect(inv).toBeDefined();
  });

  it("HONEST LIMIT: the unparameterized default (KnobId = string) does NOT refuse free text", () => {
    const inv: Invariant = { id: ID, knob: "literally anything", description: "unnarrowed default" };
    expect(inv.knob).toBe("literally anything");
  });
});
