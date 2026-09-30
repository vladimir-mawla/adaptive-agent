import type { BehaviorDelta } from "../contracts/behavior-delta.js";
import type { Invariant } from "../contracts/invariant.js";

/**
 * `gate` — plan §3 M4's own scope: "`gate(delta: BehaviorDelta, invariants:
 * Invariant[]): "eligible" | "frozen"` — evaluated purely on `delta.knob`
 * against the domain's frozen invariant list, independent of any evidence."
 * This file is the whole of that scope: it reads no `Episode`, no
 * `EvidenceTally` (that is `lib/evidence`, M3, already built and FROZEN —
 * see `.genesis/decisions/0003-evidence.md`), and rules on no
 * `AdaptationDecision` (that is `lib/arbitrate`, M5, unbuilt). This is a
 * knob-only lookup, full stop.
 *
 * THE STRONGEST FORM OF "IMMUNE TO EVIDENCE VOLUME" THIS FILE CAN MAKE,
 * STATED PRECISELY: `gate`'s own signature has NO PARAMETER through which an
 * `EvidenceTally`, an `Episode`, or a policy constant could even be handed
 * to it — passing one is not merely ignored, it is a `tsc` error at the call
 * site (an extra argument past the declared arity). This is a stronger
 * guarantee than "gate reads evidence but disregards it": there is no route
 * BY WHICH evidence reaches this function's logic in the first place, so a
 * thousand corroborating episodes across a thousand distinct contexts cannot
 * change the answer for the same structural reason a function with no
 * network access cannot leak data over the network — not because it chooses
 * not to, but because the capability does not exist in its signature.
 * `__tests__/immunity.test.ts` proves this empirically too, not just by
 * reading the signature: it builds a REAL `EvidenceTally` (via `lib/evidence`
 * `tally()`, already built) from 10,000 synthetic `"helped"` episodes spread
 * across thousands of distinct contexts — comfortably clearing any bar M5
 * could plausibly set — and confirms `gate` still returns `"frozen"` for a
 * delta targeting an invariant-protected knob, with or without that tally
 * anywhere in scope.
 *
 * SIGNATURE DEVIATES FROM THE PLAN'S LITERAL TEXT — `gate(delta, invariants:
 * Invariant[])` becomes `gate(delta, registry: InvariantRegistry<KnobId>)` —
 * for two independent reasons recorded in full in
 * `.genesis/decisions/0004-gate.md`, matching the identical "signature
 * deviates, documented, not silently patched" shape M3's own
 * `.genesis/decisions/0003-evidence.md` already set:
 *
 * 1. `KnobId` IS GENERIC ON `Invariant`/`BehaviorDelta` (M1, FROZEN, see
 *    `lib/contracts/invariant.ts`/`behavior-delta.ts`) — a bare,
 *    unparameterized `Invariant[]` would silently widen back to
 *    `Invariant<string>`, the exact free-text hole M1's own ADR discloses
 *    and does not want re-opened here. `gate<KnobId, KnobValue>` threads the
 *    SAME `KnobId` through `delta: BehaviorDelta<KnobId, KnobValue>` and the
 *    registry, so a delta and a registry built for two DIFFERENT domains'
 *    knob unions fail to compile together rather than silently comparing
 *    two unrelated string sets.
 * 2. THE PLAN'S OWN PRIOR ADR ALREADY NAMES THE SHAPE THIS FILE MUST OWN —
 *    `lib/contracts/invariant.ts`'s own header states plainly: "M4's
 *    `lib/invariants/**` (unbuilt) is where that scan belongs, ONCE THERE IS
 *    A REGISTRY AND GATE FUNCTION TO SCAN." A bare `Invariant[]` parameter
 *    cannot BE that registry — a plain array has no construction step to
 *    gate access through, and TypeScript's `readonly` modifier is
 *    compile-time only (erased at runtime, exactly this milestone's task
 *    calls out: "`readonly` in the type system is erased at runtime"). An
 *    opaque, branded `InvariantRegistry<KnobId>` (below), mintable only
 *    through `createInvariantRegistry`, is what makes "declared once per
 *    domain at setup and not extensible at runtime" (plan §2) a REAL
 *    constraint on the value `gate` actually consults, not a comment next to
 *    a plain array anyone could still push to.
 */

declare const invariantRegistryBrand: unique symbol;

/**
 * An immutable, already-validated collection of `Invariant`s, mintable only
 * through `createInvariantRegistry` below. The brand (`unique symbol`,
 * present only at the type level, never at runtime) stops a caller from
 * satisfying this type with an ordinary array literal or an existing
 * `Invariant[]` binding WITHOUT a cast — the same "opaque token, not a bare
 * shape" discipline `lib/contracts/ids.ts` already uses for
 * `InvariantId`/`BehaviorDeltaId`/`ContextId`, applied here to a collection
 * rather than a single value.
 *
 * WHAT THE BRAND DOES AND DOES NOT DO, STATED PRECISELY: it means a domain
 * cannot hand `gate` a plain `Invariant[]` by accident — `tsc` refuses
 * `gate(delta, plainArray)` for any `plainArray: Invariant<K>[]` not
 * produced by `createInvariantRegistry`. It does NOT stop a caller willing to
 * write a visible, deliberate `as unknown as InvariantRegistry<K>` cast
 * around a plain, unfrozen array — no brand, in any TypeScript codebase,
 * stops that (the identical disclosed residual `lib/contracts`'
 * `adaptation-decision.ts` already names for `FrozenDecision`, and
 * `agent-control-tower`'s own `HumanId` names for itself). See
 * `.genesis/decisions/0004-gate.md` for the full, named list of which
 * mutation ATTACKS this file's runtime freezing stops and which it does
 * not — the brand alone is a compile-time speed bump against an HONEST
 * mistake, not a defense against a hostile cast.
 */
export type InvariantRegistry<KnobId extends string = string> = readonly Invariant<KnobId>[] & {
  readonly [invariantRegistryBrand]: "InvariantRegistry";
};

/**
 * Mints an `InvariantRegistry` from a domain's own `Invariant[]` — the ONE
 * legitimate construction path plan §2 describes ("declared once per domain
 * at setup"). Runs exactly once per registry, at domain setup time (M6,
 * unbuilt, is the intended caller); `gate` itself never calls this — it only
 * reads an already-minted registry.
 *
 * ENFORCEMENT, STATED EXACTLY, NOT MORE STRONGLY THAN IT HOLDS (this
 * project's own standing discipline, see `.genesis/decisions/
 * 0001-contracts.md` Decision 1's "restated once, at exactly the strength
 * that survives"):
 *
 * 1. **A DEFENSIVE COPY, NOT THE CALLER'S OWN ARRAY OR ELEMENTS.**
 *    `invariants.map(invariant => ({ ...invariant }))` builds a brand-new
 *    array of brand-new element objects before anything is frozen. This
 *    means mutating the CALLER's original array (or its original element
 *    objects) after this call — `push`, index-assignment, reassigning a
 *    field — has ZERO effect on the registry `gate` will ever consult,
 *    because the registry no longer shares a single reference with anything
 *    the caller still holds. This is what makes the guarantee survive a
 *    caller who keeps working with their own array after minting a registry
 *    from it, not only a caller who immediately discards it.
 * 2. **`Object.freeze` ON THE COPIED ARRAY *AND* ON EVERY COPIED ELEMENT.**
 *    Freezing only the array would stop `push`/`pop`/`splice`/index
 *    assignment on the array itself but leave each `Invariant` OBJECT inside
 *    it mutable (`registry[0].description = "different now"`, which does
 *    not touch the array at all, only one of its elements) — so both layers
 *    are frozen, independently, not just the outer container.
 *
 * WHAT THIS STOPS, ENUMERATED, EACH CHECKED BY A DEDICATED TEST IN
 * `__tests__/registry.test.ts` (this list, and why each stops, is repeated
 * in `.genesis/decisions/0004-gate.md` since that ADR is the single place a
 * verifier should be able to read the whole claim without cross-referencing
 * two files):
 * - Array-mutating methods (`push`, `pop`, `shift`, `unshift`, `splice`,
 *   `sort`, `reverse`, `fill`, `copyWithin`) — all throw `TypeError` on a
 *   frozen array, in the strict-mode semantics ES modules always run under
 *   (this whole repo is `"type": "module"`, so every file, including a
 *   caller's, is strict by construction — non-strict silent-failure mode is
 *   not reachable from anywhere in this codebase).
 * - Index assignment (`registry[0] = somethingElse`) and whole-array
 *   reassignment attempts through the SAME frozen reference — throws for the
 *   identical reason.
 * - `Object.defineProperty(registry, "0", { value: x })` or any attempt to
 *   redefine/reconfigure an existing index or add a new one — throws,
 *   because `Object.freeze` makes every existing own property
 *   non-configurable and the object itself non-extensible.
 * - Reassigning a field on a returned element (`registry[0].description =
 *   "x"`) — throws, because that element is independently frozen too (point
 *   2 above), not just unreachable through the array's own mutating methods.
 * - Mutating the caller's ORIGINAL pre-registry array/objects after minting
 *   — silently has no effect on the registry (point 1 above); this is the
 *   one case that does NOT throw, by design, because nothing here forbids a
 *   caller from doing whatever they like with their OWN, no-longer-connected
 *   array. What matters is that it cannot reach `gate`'s answer, not that it
 *   is itself refused.
 *
 * WHAT THIS DOES NOT STOP, STATED ONCE, AT ITS TRUE STRENGTH (see
 * `.genesis/decisions/0004-gate.md` for the full discussion): a caller
 * willing to bypass this function entirely with `someMutableArray as unknown
 * as InvariantRegistry<K>` hands `gate` a value that is NOT frozen at all —
 * neither the brand nor `gate`'s own logic can detect this at runtime, and
 * `gate` does not call `Object.isFrozen` on its input to guard against it
 * (a deliberate scope decision, not an oversight — see the ADR for why
 * adding that check was considered and left out). This is the identical
 * class of residual `lib/contracts/adaptation-decision.ts` already discloses
 * for `frozen`'s evidence-shaped fields: no design in this language stops a
 * deliberate, visible cast.
 */
export function createInvariantRegistry<KnobId extends string = string>(
  invariants: readonly Invariant<KnobId>[],
): InvariantRegistry<KnobId> {
  const frozenElements = invariants.map((invariant) => Object.freeze({ ...invariant }));
  const frozenArray = Object.freeze(frozenElements);
  return frozenArray as unknown as InvariantRegistry<KnobId>;
}

/**
 * `gate` — the one function this milestone ships. Purely a lookup: does
 * ANY invariant in `registry` name the exact knob `delta` targets? No
 * `Episode`, no `EvidenceTally`, no policy constant, no prior-adoption
 * state, no "override" parameter of any kind exists in this signature —
 * see this file's own header for why that is a stronger claim than "ignores
 * evidence."
 *
 * Reads `registry` with a plain `for...of` — never `.push`, `.splice`, index
 * assignment, `Object.defineProperty`, or a spread that would produce a
 * MODIFIED copy standing in for the original (`__tests__/architecture.test.ts`
 * scans this file's own non-test code for exactly that vocabulary and fails
 * if any of it appears — proven to catch a real offense, see this
 * milestone's falsifiability log in `.genesis/decisions/0004-gate.md`).
 */
export function gate<KnobId extends string = string, KnobValue = unknown>(
  delta: BehaviorDelta<KnobId, KnobValue>,
  registry: InvariantRegistry<KnobId>,
): "eligible" | "frozen" {
  for (const invariant of registry) {
    if (invariant.knob === delta.knob) return "frozen";
  }
  return "eligible";
}
