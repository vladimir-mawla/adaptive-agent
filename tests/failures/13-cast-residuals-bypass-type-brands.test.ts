import { describe, expect, it } from "vitest";
import { behaviorDeltaId, invariantId } from "../../lib/contracts/ids.js";
import { timestamp } from "../../lib/contracts/timestamp.js";
import type { Invariant } from "../../lib/contracts/invariant.js";
import { createInvariantRegistry, gate } from "../../lib/invariants/gate.js";
import type { InvariantRegistry } from "../../lib/invariants/gate.js";
import { proposeDelta, type AdaptableKnobId } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { SUPPORT_TRIAGE_REGISTRY, type DomainKnobId } from "../../domains/support-triage/invariants.js";
import { VACANT } from "./helpers.js";

/**
 * ============================================================
 * CASE 13 — CAST RESIDUALS: `as unknown as` DEFEATS THE `InvariantRegistry`
 * BRAND AND THE `AdaptableKnobId` UNION — THOUGH THE RUNTIME REGISTRY
 * CHECK STILL CATCHES THE SMUGGLED KNOB (named explicitly in this
 * milestone's own brief)
 * ============================================================
 * KIND: PART (a) PROVES A REFUSAL HOLDS. PART (b) DISCLOSES A REAL,
 * UNSOLVED GAP.
 *
 * PART (a) — THE SAFETY NET HOLDS: `domains/support-triage/knobs.ts`'s own
 * header discloses that a deliberate cast
 * (`("auto-refund" + "-ceiling") as AdaptableKnobId`) defeats its own
 * two COSMETIC guard-rails (the type-level union and the source-scan
 * test) — but `.genesis/decisions/0006-domain.md` records that L4 VERIFY
 * ran this cast-smuggled delta through the real pipeline and it still
 * resolved `frozen`, because `lib/invariants.gate` compares the delta's
 * RUNTIME `knob` string against the registry, never the compile-time type
 * a cast can lie about. That finding was never turned into a persisted,
 * committed test anywhere in this repo — this is that test, run for real
 * rather than taken on the ADR's own account.
 *
 * PART (b) — THE GAP THAT REMAINS: `lib/invariants/gate.ts`'s own header
 * discloses a DIFFERENT residual: "a deliberate
 * `someMutableArray as unknown as InvariantRegistry<K>` cast... hands
 * `gate` a value that is NOT frozen at all." `lib/invariants/__tests__/
 * registry.test.ts` already proves the cast-bypassed array does not
 * throw when pushed to — this case goes one step further, demonstrating
 * the actual CONSEQUENCE: a caller willing to cast can REMOVE the one
 * seeded invariant from a bypassed registry and make a
 * previously-protected knob eligible again.
 *
 * WHAT WOULD MAKE (a) FAIL: `gate`'s matching predicate depending on
 * anything other than the delta's runtime `knob` string. WHAT WOULD MAKE
 * (b) NO LONGER BE A GAP: `gate` calling `Object.isFrozen`/`Object.
 * isSealed` on its `registry` parameter and refusing an unfrozen one —
 * a deliberate scope decision `.genesis/decisions/0004-gate.md` records
 * as considered and left out, not an oversight.
 */
describe("CASE 13a (PROVES): a cast-smuggled knob name still resolves frozen through the real pipeline", () => {
  it("a delta whose knob is built via runtime string concatenation, cast to AdaptableKnobId, bypassing knobs.ts's type guard and source scan, still resolves frozen when run through evaluateDelta", () => {
    const sneakyKnob = ("auto-refund" + "-ceiling") as AdaptableKnobId;
    // proposeDelta's own parameter type is AdaptableKnobId — this cast is
    // exactly what makes the otherwise-impossible call below compile.
    const smuggled = proposeDelta({
      id: "failure-case-13a-smuggled",
      knob: sneakyKnob,
      from: 500,
      to: 1000,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    // Widen to DomainKnobId the same way scenario.ts's own ordinary deltas
    // do (a narrower literal union is a subtype of a wider one containing
    // it — no additional cast needed for this step).
    const widened: Parameters<typeof evaluateDelta>[0] = smuggled;
    const result = evaluateDelta(widened, [], VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("frozen");
    expect(result.decision.kind === "frozen" && result.decision.invariant).toBe("inv-auto-refund-ceiling");
  });
});

describe("CASE 13b (DISCLOSES): a cast-bypassed, unfrozen registry can have its one protected invariant silently removed", () => {
  it("createInvariantRegistry's brand and freeze are both erased at runtime by a deliberate cast around a plain array — removing an invariant from the bypassed copy makes the previously-protected knob eligible again", () => {
    const protectedInvariant: Invariant<DomainKnobId> = {
      id: invariantId("inv-test-refund-ceiling"),
      knob: "auto-refund-ceiling",
      description: "test-only stand-in invariant",
    };
    const realRegistry: InvariantRegistry<DomainKnobId> = createInvariantRegistry([protectedInvariant]);

    // THE BYPASS: a deliberate cast around a value that was never actually
    // frozen — matching lib/invariants/__tests__/registry.test.ts's own
    // "DISCLOSED RESIDUAL" test, which stops at confirming this does not
    // throw. This case goes one step further: a mutable array built fresh
    // (not derived from realRegistry, since that one genuinely IS frozen)
    // typed AS IF it were a real registry.
    const plainMutableArray: Invariant<DomainKnobId>[] = [protectedInvariant];
    const bypassedRegistry = plainMutableArray as unknown as InvariantRegistry<DomainKnobId>;

    const attackDelta = {
      id: behaviorDeltaId("failure-case-13b-attack"),
      knob: "auto-refund-ceiling" as DomainKnobId,
      from: 500,
      to: 1000,
      proposedAt: timestamp("2026-03-01T00:00:00Z"),
    };

    // Before the attack: the bypassed registry still behaves identically
    // to a real one, because nothing has been removed from it yet.
    expect(gate(attackDelta, bypassedRegistry)).toBe("frozen");

    // THE ATTACK: splice the one protected invariant OUT of the bypassed,
    // unfrozen array — a write `Object.freeze` would have refused on the
    // genuine registry, but which this cast-around value permits, because
    // it was never actually frozen at all.
    (bypassedRegistry as unknown as Invariant<DomainKnobId>[]).splice(0, 1);

    // THE CONSEQUENCE: the SAME delta, against the SAME (now-tampered)
    // registry reference, is no longer frozen — the invariant protection
    // has been silently defeated.
    expect(gate(attackDelta, bypassedRegistry)).toBe("eligible");

    // CONTROL: the real, genuinely-constructed registry cannot be
    // tampered with the same way — confirming this is a property of the
    // CAST, not of createInvariantRegistry failing in general.
    expect(() => (realRegistry as unknown as Invariant<DomainKnobId>[]).splice(0, 1)).toThrow(TypeError);
    expect(gate(attackDelta, realRegistry)).toBe("frozen");
  });

  it("CONTROL, confirming this domain's own real, shipped registry is unaffected by this attack (the attack requires building a SEPARATE bypassed value, never touching SUPPORT_TRIAGE_REGISTRY itself)", () => {
    const delta = proposeDelta({
      id: "failure-case-13b-control",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.8,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    expect(gate(delta, SUPPORT_TRIAGE_REGISTRY)).toBe("eligible");
    expect(SUPPORT_TRIAGE_REGISTRY).toHaveLength(1);
  });
});
