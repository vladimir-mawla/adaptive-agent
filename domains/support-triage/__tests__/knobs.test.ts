import { describe, expect, it } from "vitest";
import type { BehaviorDelta } from "../../../lib/contracts/behavior-delta.js";
import type { DomainKnobId } from "../invariants.js";
import { ADAPTABLE_KNOB_IDS, proposeDelta, type AdaptableKnobId } from "../knobs.js";

describe("AdaptableKnobId is a closed, two-member set that never includes auto-refund-ceiling", () => {
  it("ADAPTABLE_KNOB_IDS names exactly escalation-aggressiveness and response-directness", () => {
    expect([...ADAPTABLE_KNOB_IDS].sort()).toEqual(["escalation-aggressiveness", "response-directness"]);
  });

  it("proposeDelta builds a real BehaviorDelta from plain input", () => {
    const delta = proposeDelta({
      id: "delta-test-1",
      knob: "escalation-aggressiveness",
      from: 0.3,
      to: 0.6,
      proposedAt: "2026-01-01T00:00:00Z",
    });
    expect(delta.knob).toBe("escalation-aggressiveness");
    expect(delta.from).toBe(0.3);
    expect(delta.to).toBe(0.6);
  });

  it("TYPE-LEVEL: proposeDelta refuses 'auto-refund-ceiling' as a knob name — it is not a member of AdaptableKnobId at all", () => {
    const delta = proposeDelta({
      id: "delta-test-2",
      // @ts-expect-error — "auto-refund-ceiling" is not assignable to AdaptableKnobId; this domain's own proposal function structurally cannot name the invariant-protected knob.
      knob: "auto-refund-ceiling",
      from: 500,
      to: 750,
      proposedAt: "2026-01-01T00:00:00Z",
    });
    expect(delta).toBeDefined();
  });

  it("TYPE-LEVEL: AdaptableKnobId itself refuses 'auto-refund-ceiling' as a member", () => {
    // @ts-expect-error — "auto-refund-ceiling" is not a member of the two-value AdaptableKnobId union.
    const knob: AdaptableKnobId = "auto-refund-ceiling";
    expect(knob).toBeDefined();
  });

  it("a proposed delta (narrower AdaptableKnobId) widens cleanly into a DomainKnobId-typed binding, no cast required", () => {
    const delta = proposeDelta({
      id: "delta-test-3",
      knob: "response-directness",
      from: 0.2,
      to: 0.4,
      proposedAt: "2026-01-01T00:00:00Z",
    });
    const widened: BehaviorDelta<DomainKnobId, number> = delta;
    expect(widened.knob).toBe("response-directness");
  });
});
