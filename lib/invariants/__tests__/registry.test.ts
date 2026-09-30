import { describe, expect, it } from "vitest";
import { invariantId } from "../../contracts/index.js";
import type { Invariant } from "../../contracts/index.js";
import { createInvariantRegistry } from "../gate.js";

type KnobId = "auto-refund-ceiling" | "escalation-aggressiveness";

function makeInvariant(knob: KnobId, description = "seed description"): Invariant<KnobId> {
  return { id: invariantId(`invariant-${knob}`), knob, description };
}

/**
 * "NO RUNTIME MUTATION PATH FOR THE INVARIANT LIST" — EACH ATTACK NAMED IN
 * THIS MILESTONE'S OWN TASK, CHECKED ONE AT A TIME, NOT ASSERTED IN BULK.
 * Every "throws" expectation below was confirmed to ACTUALLY throw
 * (`toThrow()`, not merely "does not equal the mutated value") — a silent
 * no-op (non-strict-mode semantics) would fail these tests as loudly as a
 * mutation that quietly succeeded would, which is the point: this repo is
 * `"type": "module"` end to end, so every file (including a hostile
 * caller's own) runs under strict-mode semantics where a frozen-object
 * write throws rather than silently doing nothing — there is no reachable
 * non-strict script context anywhere in this codebase for a mutation to
 * "succeed silently" in instead.
 */
describe("createInvariantRegistry: what each mutation attack actually does", () => {
  it("ATTACK: array-mutating methods (push/pop/shift/unshift/splice/sort/reverse/fill/copyWithin) — all throw", () => {
    // Two elements, deliberately — `sort`/`reverse` on a 1-length array
    // perform no internal write at all (V8 short-circuits: there is nothing
    // to reorder), so they would falsely appear to "not throw" against a
    // single-element registry even though the write-refusal mechanism is
    // identical. Checked directly: this was caught by running this exact
    // test against a 1-length registry first — `sort()`/`reverse()` failed
    // to throw, not because freezing didn't work, but because those two
    // methods never attempted a write in the first place at that length.
    const registry = createInvariantRegistry([
      makeInvariant("auto-refund-ceiling"),
      makeInvariant("escalation-aggressiveness"),
    ]);
    const mutable = registry as unknown as Invariant<KnobId>[];
    expect(() => mutable.push(makeInvariant("auto-refund-ceiling"))).toThrow(TypeError);
    expect(() => mutable.pop()).toThrow(TypeError);
    expect(() => mutable.shift()).toThrow(TypeError);
    expect(() => mutable.unshift(makeInvariant("auto-refund-ceiling"))).toThrow(TypeError);
    expect(() => mutable.splice(0, 1)).toThrow(TypeError);
    expect(() => mutable.sort()).toThrow(TypeError);
    expect(() => mutable.reverse()).toThrow(TypeError);
    expect(() => (mutable as unknown[]).fill(null)).toThrow(TypeError);
    expect(() => mutable.copyWithin(0, 1)).toThrow(TypeError);
    // None of the above actually changed anything — the registry still has
    // exactly its original two elements in their original order, confirming
    // these are real refusals, not silently-swallowed no-ops that happened
    // to also not throw.
    expect(registry.length).toBe(2);
    expect(registry[0]?.knob).toBe("auto-refund-ceiling");
    expect(registry[1]?.knob).toBe("escalation-aggressiveness");
  });

  it("ATTACK: index assignment on the returned reference — throws, value unchanged", () => {
    const registry = createInvariantRegistry([makeInvariant("auto-refund-ceiling")]);
    const mutable = registry as unknown as Invariant<KnobId>[];
    expect(() => {
      mutable[0] = makeInvariant("escalation-aggressiveness");
    }).toThrow(TypeError);
    expect(registry[0]?.knob).toBe("auto-refund-ceiling");
  });

  it("ATTACK: Object.defineProperty on the returned reference — throws for an existing index and for a new one", () => {
    const registry = createInvariantRegistry([makeInvariant("auto-refund-ceiling")]);
    expect(() => Object.defineProperty(registry, 0, { value: makeInvariant("escalation-aggressiveness") })).toThrow(
      TypeError,
    );
    expect(() => Object.defineProperty(registry, 1, { value: makeInvariant("escalation-aggressiveness") })).toThrow(
      TypeError,
    );
    expect(registry.length).toBe(1);
  });

  it("ATTACK: reassigning a field on a returned ELEMENT (not the array) — throws, because elements are frozen independently", () => {
    const registry = createInvariantRegistry([makeInvariant("auto-refund-ceiling", "original")]);
    const element = registry[0] as { description: string };
    expect(() => {
      element.description = "tampered";
    }).toThrow(TypeError);
    expect(registry[0]?.description).toBe("original");
  });

  it("Object.isFrozen is true for the registry array and for every element — the mechanism this milestone actually relies on, checked directly rather than only through its throwing side effects", () => {
    const registry = createInvariantRegistry([makeInvariant("auto-refund-ceiling"), makeInvariant("escalation-aggressiveness")]);
    expect(Object.isFrozen(registry)).toBe(true);
    for (const invariant of registry) {
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  it("NOT AN ATTACK THIS FUNCTION STOPS, BY DESIGN — decoupling, not refusal: mutating the CALLER's original input array/objects after construction has zero effect on the registry, and does not itself throw", () => {
    const original = [makeInvariant("auto-refund-ceiling", "original")];
    const registry = createInvariantRegistry(original);
    // The caller's own array is untouched by createInvariantRegistry and
    // remains exactly as mutable as any ordinary array — this line
    // succeeding (not throwing) is the expected, intended behavior, not a
    // gap: nothing here promises to freeze the CALLER's own working copy,
    // only to make the REGISTRY immune to it.
    original.push(makeInvariant("escalation-aggressiveness"));
    original[0] = { ...original[0], description: "mutated after the fact" } as Invariant<KnobId>;
    expect(registry.length).toBe(1);
    expect(registry[0]?.description).toBe("original");
  });

  it("DISCLOSED RESIDUAL, NOT CLOSED BY THIS FUNCTION: a deliberate cast around a plain mutable array bypasses both the brand and the freeze entirely", () => {
    const plainMutableArray: Invariant<KnobId>[] = [makeInvariant("auto-refund-ceiling")];
    const bypassed = plainMutableArray as unknown as ReturnType<typeof createInvariantRegistry<KnobId>>;
    // This is the honest point of this test: it does NOT throw, because
    // `bypassed` never went through createInvariantRegistry at all — the
    // brand is erased at runtime and gate() performs no Object.isFrozen
    // check of its own (a deliberate scope decision, see
    // .genesis/decisions/0004-gate.md). Recorded here as a passing
    // "DISCLOSED LIMIT" test, the same shape lib/contracts' own
    // adaptation-decision.test.ts uses for its cast residual, not left
    // silent for a reader to discover on their own.
    expect(() => {
      (bypassed as unknown as Invariant<KnobId>[]).push(makeInvariant("escalation-aggressiveness"));
    }).not.toThrow();
    expect(plainMutableArray.length).toBe(2);
  });
});
