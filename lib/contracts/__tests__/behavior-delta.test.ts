import { describe, expect, it } from "vitest";
import type { BehaviorDelta } from "../behavior-delta.js";
import { behaviorDeltaId } from "../ids.js";
import { timestamp } from "../timestamp.js";

const ID = behaviorDeltaId("delta-1");
const WHEN = timestamp("2026-09-23T00:00:00.000Z");

describe("BehaviorDelta refuses to compile without both from and to", () => {
  it("constructs a valid delta with both from and to present", () => {
    const delta: BehaviorDelta = { id: ID, knob: "any-knob", from: 1, to: 2, proposedAt: WHEN };
    expect(delta.from).toBe(1);
    expect(delta.to).toBe(2);
  });

  it("TYPE-LEVEL: missing `from` does not compile", () => {
    // @ts-expect-error — `from` is required; a delta that doesn't state what it's changing from cannot be checked for direction or magnitude later.
    const delta: BehaviorDelta = { id: ID, knob: "any-knob", to: 2, proposedAt: WHEN };
    expect(delta).toBeDefined();
  });

  it("TYPE-LEVEL: missing `to` does not compile", () => {
    // @ts-expect-error — `to` is required for the same reason `from` is.
    const delta: BehaviorDelta = { id: ID, knob: "any-knob", from: 1, proposedAt: WHEN };
    expect(delta).toBeDefined();
  });
});

/**
 * KnobId is generic (see behavior-delta.ts's header): a domain narrows it
 * to its own closed literal union once one exists (M6, unbuilt). This
 * milestone proves the MECHANISM on a local stand-in union, the same way
 * agent-control-tower proves assertNeverIntervention on a local stand-in
 * type rather than pre-guessing or widening a real downstream type.
 */
type StandInKnobId = "escalation-aggressiveness" | "response-directness";

describe("a domain's own narrowed KnobId union refuses a knob name outside its closed set", () => {
  it("accepts a knob name that is a member of the local stand-in union", () => {
    const delta: BehaviorDelta<StandInKnobId, number> = {
      id: ID,
      knob: "escalation-aggressiveness",
      from: 0.2,
      to: 0.5,
      proposedAt: WHEN,
    };
    expect(delta.knob).toBe("escalation-aggressiveness");
  });

  it("TYPE-LEVEL: a knob name outside the narrowed union does not compile", () => {
    const delta: BehaviorDelta<StandInKnobId, number> = {
      id: ID,
      // @ts-expect-error — "auto-refund-ceiling" is not a member of the local StandInKnobId union; a narrowed domain contract refuses free text.
      knob: "auto-refund-ceiling",
      from: 0.2,
      to: 0.5,
      proposedAt: WHEN,
    };
    expect(delta).toBeDefined();
  });

  it("HONEST LIMIT: the unparameterized default (KnobId = string) does NOT refuse free text — only a domain's own narrowed instantiation does", () => {
    const delta: BehaviorDelta = { id: ID, knob: "literally anything", from: 1, to: 2, proposedAt: WHEN };
    expect(delta.knob).toBe("literally anything");
  });
});
