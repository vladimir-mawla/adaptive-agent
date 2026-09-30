import { describe, expect, it } from "vitest";
import { invariantId } from "../../lib/contracts/ids.js";
import type { Invariant } from "../../lib/contracts/invariant.js";
import { createInvariantRegistry } from "../../lib/invariants/gate.js";

type KnobId = "auto-refund-ceiling" | "escalation-aggressiveness";

/**
 * ============================================================
 * CASE 14 — `Object.freeze` IS ONE LEVEL DEEP (named explicitly in this
 * milestone's own brief; recorded in `.genesis/decisions/0004-gate.md`
 * Decision 3)
 * ============================================================
 * KIND: DISCLOSES A REAL, CONDITIONAL GAP — accurate today only because
 * of a fact about `Invariant`'s current shape.
 *
 * THE GAP, STATED PLAINLY: `createInvariantRegistry` calls
 * `Object.freeze({ ...invariant })` on each copied element — this freezes
 * exactly the copied object's OWN, top-level properties. It does NOT
 * recurse into any property whose own value is itself an object.
 * `0004-gate.md` states this is "accurate today, not an overclaim, only
 * because of a fact about `Invariant`'s CURRENT shape" — `id`/`knob`/
 * `description` are all primitives (`string`), so there is nothing nested
 * for a one-level freeze to miss, TODAY.
 *
 * WHY THIS TEST MUST REACH FOR A CAST TO DEMONSTRATE THE GAP AT ALL:
 * `Invariant<KnobId>` (M1, FROZEN) declares exactly three string fields —
 * there is no legitimate, type-correct way to construct an `Invariant`
 * carrying a fourth, object-valued field. This is not a loophole in this
 * test's own construction; it is the DIRECT, literal demonstration of
 * `0004-gate.md`'s own conditional: "if `Invariant` ... ever gains a field
 * whose value is an object ... that field remains mutable ... whoever
 * adds that field must either deep-freeze the copied element ... or
 * explicitly re-scope this sentence." Simulating that future field via a
 * cast is the only way to exercise the condition before it actually
 * happens.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED):
 * `createInvariantRegistry` deep-freezing each copied element (e.g.
 * recursively, or via a library) — at which point the nested mutation
 * below would throw instead of succeeding.
 */
describe("CASE 14 (DISCLOSES): Object.freeze on a registry element does not protect a nested object-valued field", () => {
  it("mutating a top-level string field on a frozen registry element throws (the control — the one-level freeze DOES work at this level)", () => {
    const invariant: Invariant<KnobId> = {
      id: invariantId("inv-test-1"),
      knob: "auto-refund-ceiling",
      description: "original",
    };
    const registry = createInvariantRegistry([invariant]);
    const element = registry[0] as { description: string };
    expect(() => {
      element.description = "tampered";
    }).toThrow(TypeError);
    expect(registry[0]?.description).toBe("original");
  });

  it("THE GAP: a cast-smuggled nested object-valued field on an Invariant survives createInvariantRegistry's freeze completely mutable, even though the element itself reports Object.isFrozen: true", () => {
    // Invariant<KnobId> has no object-valued field to legitimately assign
    // here — this cast simulates the exact future addition
    // 0004-gate.md's own conditional names, not a malformed input.
    type InvariantWithNestedMetadata = Invariant<KnobId> & { metadata: { severity: string } };
    const invariantWithNested = {
      id: invariantId("inv-test-2"),
      knob: "auto-refund-ceiling",
      description: "original",
      metadata: { severity: "high" },
    } as InvariantWithNestedMetadata;

    const registry = createInvariantRegistry([invariantWithNested as unknown as Invariant<KnobId>]);
    const element = registry[0] as unknown as InvariantWithNestedMetadata;

    // The element itself IS frozen (the one-level mechanism worked)...
    expect(Object.isFrozen(element)).toBe(true);
    // ...but its own freeze did not recurse into `metadata` — this nested
    // object is NOT frozen, and mutating it succeeds without throwing.
    expect(Object.isFrozen(element.metadata)).toBe(false);
    expect(() => {
      element.metadata.severity = "tampered";
    }).not.toThrow();
    expect(element.metadata.severity).toBe("tampered");
    // Reassigning the metadata FIELD itself (not its nested contents) is
    // still refused — only the nested object's own properties are
    // unprotected, confirming this is specifically a depth limit, not a
    // wholesale failure of createInvariantRegistry's freeze.
    expect(() => {
      (element as { metadata: unknown }).metadata = { severity: "replaced entirely" };
    }).toThrow(TypeError);
  });
});
