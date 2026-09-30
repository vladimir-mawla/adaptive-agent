import { describe, expect, it } from "vitest";
import { behaviorDeltaId } from "../../../lib/contracts/ids.js";
import { timestamp } from "../../../lib/contracts/timestamp.js";
import type { BehaviorDelta } from "../../../lib/contracts/behavior-delta.js";
import { gate } from "../../../lib/invariants/gate.js";
import { proposeDelta } from "../knobs.js";
import { AUTO_REFUND_CEILING_INVARIANT, SUPPORT_TRIAGE_INVARIANTS, SUPPORT_TRIAGE_REGISTRY, type DomainKnobId } from "../invariants.js";

describe("this domain's one seeded invariant", () => {
  it("SUPPORT_TRIAGE_INVARIANTS has exactly one entry, naming auto-refund-ceiling", () => {
    expect(SUPPORT_TRIAGE_INVARIANTS).toHaveLength(1);
    expect(SUPPORT_TRIAGE_INVARIANTS[0]).toBe(AUTO_REFUND_CEILING_INVARIANT);
    expect(AUTO_REFUND_CEILING_INVARIANT.knob).toBe("auto-refund-ceiling");
  });

  it("the minted registry is what lib/invariants.gate actually consults — an adaptable-knob delta is eligible", () => {
    const delta = proposeDelta({
      id: "delta-invariants-test-1",
      knob: "escalation-aggressiveness",
      from: 0.5,
      to: 0.9,
      proposedAt: "2026-01-01T00:00:00Z",
    });
    expect(gate<DomainKnobId, number>(delta, SUPPORT_TRIAGE_REGISTRY)).toBe("eligible");
  });

  it("a delta hand-built to target auto-refund-ceiling is frozen — bypassing knobs.ts entirely", () => {
    const attack: BehaviorDelta<DomainKnobId, number> = {
      id: behaviorDeltaId("delta-invariants-test-attack"),
      knob: "auto-refund-ceiling",
      from: 500,
      to: 1000,
      proposedAt: timestamp("2026-01-01T00:00:00Z"),
    };
    expect(gate<DomainKnobId, number>(attack, SUPPORT_TRIAGE_REGISTRY)).toBe("frozen");
  });

  it("the other adaptable knob (response-directness) is also eligible — the registry names only auto-refund-ceiling, not both adaptable knobs by omission", () => {
    const delta = proposeDelta({
      id: "delta-invariants-test-2",
      knob: "response-directness",
      from: 0.3,
      to: 0.5,
      proposedAt: "2026-01-01T00:00:00Z",
    });
    expect(gate<DomainKnobId, number>(delta, SUPPORT_TRIAGE_REGISTRY)).toBe("eligible");
  });
});
