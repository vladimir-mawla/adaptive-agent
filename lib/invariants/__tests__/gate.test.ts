import { describe, expect, it } from "vitest";
import { behaviorDeltaId, invariantId, timestamp } from "../../contracts/index.js";
import type { BehaviorDelta, Invariant } from "../../contracts/index.js";
import { createInvariantRegistry, gate } from "../gate.js";

/**
 * A LOCAL stand-in domain, the same "prove the mechanism on a local
 * stand-in, don't dishonestly widen or pre-guess the real thing" discipline
 * `lib/contracts/invariant.ts`'s own header documents for M1 and M6
 * (support-triage, unbuilt) will eventually replace with a real one. Mirrors
 * the plan's own example names (§2) without importing anything from a
 * domain this milestone does not own.
 */
type KnobId = "escalation-aggressiveness" | "response-directness" | "auto-refund-ceiling";

function makeDelta(knob: KnobId, from: number, to: number): BehaviorDelta<KnobId, number> {
  return {
    id: behaviorDeltaId(`delta-${knob}`),
    knob,
    from,
    to,
    proposedAt: timestamp("2026-09-30T00:00:00Z"),
  };
}

function oneInvariant(knob: KnobId): Invariant<KnobId> {
  return { id: invariantId("auto-refund-ceiling-invariant"), knob, description: "never adaptable" };
}

describe("gate: knob-only lookup, nothing else", () => {
  it("returns 'frozen' when delta.knob matches an invariant's own knob", () => {
    const registry = createInvariantRegistry([oneInvariant("auto-refund-ceiling")]);
    const delta = makeDelta("auto-refund-ceiling", 500, 1000);
    expect(gate(delta, registry)).toBe("frozen");
  });

  it("returns 'eligible' when delta.knob matches no invariant in the registry", () => {
    const registry = createInvariantRegistry([oneInvariant("auto-refund-ceiling")]);
    const delta = makeDelta("escalation-aggressiveness", 0.3, 0.5);
    expect(gate(delta, registry)).toBe("eligible");
  });

  it("returns 'eligible' against an empty registry — no invariant exists to freeze anything", () => {
    const registry = createInvariantRegistry([]);
    const delta = makeDelta("response-directness", 0.2, 0.9);
    expect(gate(delta, registry)).toBe("eligible");
  });

  it("matches purely on the knob string, ignoring which Invariant.id / description happen to be attached", () => {
    const registry = createInvariantRegistry([
      { id: invariantId("some-other-id-entirely"), knob: "response-directness", description: "unrelated prose" },
    ]);
    const delta = makeDelta("response-directness", 0.1, 0.2);
    expect(gate(delta, registry)).toBe("frozen");
  });

  it("is a pure function of (delta.knob, registry) — identical inputs, repeated calls, identical answer", () => {
    const registry = createInvariantRegistry([oneInvariant("auto-refund-ceiling")]);
    const delta = makeDelta("auto-refund-ceiling", 500, 1000);
    const results = Array.from({ length: 50 }, () => gate(delta, registry));
    expect(results.every((r) => r === "frozen")).toBe(true);
  });

  it("checks every invariant in a multi-invariant registry, not just the first", () => {
    const registry = createInvariantRegistry([
      { id: invariantId("i1"), knob: "response-directness", description: "d1" },
      { id: invariantId("i2"), knob: "auto-refund-ceiling", description: "d2" },
    ]);
    expect(gate(makeDelta("response-directness", 0, 1), registry)).toBe("frozen");
    expect(gate(makeDelta("auto-refund-ceiling", 0, 1), registry)).toBe("frozen");
    expect(gate(makeDelta("escalation-aggressiveness", 0, 1), registry)).toBe("eligible");
  });

  it("STRUCTURAL PROOF: gate's own signature has no slot for evidence at all — passing a third argument is a compile error, not a runtime no-op", () => {
    const registry = createInvariantRegistry([oneInvariant("auto-refund-ceiling")]);
    const delta = makeDelta("auto-refund-ceiling", 500, 1000);
    // @ts-expect-error — gate takes exactly two parameters; a tally, an
    // episode array, or any third argument at all is a TS2554 arity error
    // at this call site, never merely ignored at runtime. This is the
    // compile-time half of the "immune to evidence volume" claim; see
    // __tests__/immunity.test.ts for the runtime half (a real, huge tally
    // computed and still never reaching this function).
    gate(delta, registry, { deltaId: delta.id, distinctContexts: 99999, helped: 99999, neutral: 0, harmed: 0 });
    expect(gate(delta, registry)).toBe("frozen");
  });
});
