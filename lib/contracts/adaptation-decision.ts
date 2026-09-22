import type { BehaviorDeltaId, InvariantId } from "./ids.js";
import type { EvidenceTally } from "./evidence-tally.js";

/**
 * `AdaptationDecision` — the closed enum at the centre of this project
 * (plan §2), reproduced here exactly as the plan's own code block gives
 * it, with one generic type parameter added (`KnobValue`, see below):
 *
 *   - `adopt`  — `{ kind, deltaId, tally }`
 *   - `hold`   — `{ kind, deltaId, tally, distinctContextsNeeded }`
 *   - `revert` — `{ kind, deltaId, tally, revertedTo }`
 *   - `frozen` — `{ kind, deltaId, invariant }`
 *
 * THIS FILE'S TWO CENTRAL COMMITMENTS, PROVEN WITH `@ts-expect-error` IN
 * `__tests__/adaptation-decision.test.ts` (an unused `@ts-expect-error` is
 * itself a compile error, `TS2578`, which is what makes each proof below
 * real rather than a comment asserting "this wouldn't compile"):
 *
 * 1. **`frozen` HAS NO `tally` FIELD AT ALL — NOT UNCHECKED, UNSAYABLE.**
 *    The `frozen` member of this union is `{ kind: "frozen"; deltaId:
 *    BehaviorDeltaId; invariant: InvariantId }` — no `tally` property
 *    appears anywhere in its declaration. Because `AdaptationDecision` is
 *    a discriminated union (every member has a distinct literal `kind`),
 *    writing an object literal with `kind: "frozen"` and ALSO a `tally`
 *    property directly (not through an intermediate `as`/generic escape
 *    hatch) is an excess-property-check error at the `tally` key itself —
 *    TypeScript narrows the literal to the `"frozen"` member by its
 *    discriminant and then rejects any key that member doesn't declare.
 *    This is not a runtime guard that could be skipped or a convention
 *    that could be violated by a careless call site — there is no code
 *    path, anywhere, that can produce a `frozen` decision carrying a
 *    tally without TypeScript refusing to compile it, matching exactly
 *    the plan's own reasoning: "a `frozen` decision citing evidence would
 *    misrepresent *why* it fired — it fires because of what the knob *is*,
 *    never because of what the evidence *says*."
 *
 * 2. **`hold` CARRIES `distinctContextsNeeded: number` — A NUMBER THE
 *    CALLER CAN ACT ON, NOT A BOOLEAN, NOT PROSE.** `distinctContextsNeeded`
 *    is a required `number` field, proven two ways in the test file: (a)
 *    omitting it from a `hold` literal fails to compile, and (b) assigning
 *    a `boolean` to it (`distinctContextsNeeded: true`) also fails to
 *    compile — a `hold` that merely says "not yet" without a number a
 *    caller can re-check against would satisfy the plan's own ban on "a
 *    vague 'not yet'" no better than a boolean would, so both failure
 *    shapes are pinned, not just the missing-field case.
 *
 * `adopt`/`hold`/`revert` ALL REQUIRE `tally: EvidenceTally` — "**Refuses**
 * to fire without citing the exact tally that licensed it — never a bare
 * `true`" (plan §2, `adopt`'s bullet; the same discipline applies to
 * `hold` and `revert`, whose own bullets each name their own tally-citing
 * requirement). Proven by `@ts-expect-error` on each variant's own
 * literal, omitting `tally`.
 *
 * NO OVERRIDE PARAMETER ANYWHERE IN THIS FILE, AND NONE ANYWHERE UNDER
 * `lib/contracts/**` — CHECKED, NOT JUST ASSERTED: `__tests__/
 * architecture.test.ts` greps every non-test `.ts` source file under
 * `lib/contracts/` for the substring "override" (case-insensitive) and
 * fails if it appears anywhere. This is a narrow, honest claim about THIS
 * milestone's own vocabulary only: it proves M1 ships no override-shaped
 * field, parameter, or type for a later milestone to build on top of by
 * accident — it says nothing about `lib/arbitrate/arbitrate.ts` itself
 * (M5, unbuilt), which does not exist yet for any scan to inspect. Plan §4
 * (M5) already commits, in prose, to the analogous requirement for that
 * function once it is built ("to ever consult a 'human override'
 * parameter for a `frozen` gate result, because no such parameter exists
 * in this function's signature at all") — this milestone's job is to make
 * sure the TYPES `arbitrate` will return give that function nothing to
 * name such a parameter *after*: there is no variant of
 * `AdaptationDecision` an override could plausibly feed into (`frozen`
 * takes no evidence-shaped input at all; `adopt`/`hold`/`revert` each take
 * only a `tally` computed by `lib/evidence`, not a human- or
 * caller-supplied evidence override). Whether `lib/arbitrate/arbitrate.ts`
 * ITSELF ends up honoring that is a BUILD REQUIREMENT for M5 to satisfy
 * and prove with its own test when it exists, not a claim this file makes
 * about code that does not exist yet.
 *
 * `KnobValue` IS GENERIC, THREADED THROUGH FROM `BehaviorDelta` (see that
 * file's header for the full reasoning): `revertedTo`'s type must match
 * whatever type a domain's own `BehaviorDelta<KnobId, KnobValue>` uses for
 * `from`/`to`, since a revert rolls a knob back to a value one of that
 * knob's own prior deltas produced. The unparameterized default
 * (`KnobValue = unknown`) is deliberately not narrowed further here — see
 * `behavior-delta.ts`'s header for why a concrete `KnobValue` shape is a
 * domain fact (M6, unbuilt), not this milestone's to invent.
 */
export type AdaptationDecision<KnobValue = unknown> =
  | { readonly kind: "adopt"; readonly deltaId: BehaviorDeltaId; readonly tally: EvidenceTally }
  | {
      readonly kind: "hold";
      readonly deltaId: BehaviorDeltaId;
      readonly tally: EvidenceTally;
      readonly distinctContextsNeeded: number;
    }
  | {
      readonly kind: "revert";
      readonly deltaId: BehaviorDeltaId;
      readonly tally: EvidenceTally;
      readonly revertedTo: KnobValue;
    }
  | { readonly kind: "frozen"; readonly deltaId: BehaviorDeltaId; readonly invariant: InvariantId };

/**
 * Exhaustiveness helper for `switch (decision.kind)` — same pattern as
 * `agent-control-tower`'s `assertNeverIntervention` / decision-engine's
 * `assertNeverOutcome` / shadow-run's `assertNeverReconciliation` /
 * memory-ledger's `assertNeverBeliefAnswer`. Never called at runtime (the
 * `never` parameter type makes that impossible for any value TypeScript
 * itself considers reachable); its only job is to make an unhandled
 * variant a COMPILE error at the call site the moment a fifth `kind` is
 * ever added (plan §3, M1: "an exhaustiveness guard that silently stops
 * matching a variant if a fifth is ever added without updating every
 * switch"). `AdaptationDecision` itself stays frozen at four kinds for
 * this milestone, so `__tests__/adaptation-decision.test.ts` demonstrates
 * the mechanism failing on an equivalent LOCAL five-kind stand-in type
 * rather than dishonestly widening the real one just to prove a point —
 * the same choice `agent-control-tower`'s own `intervention.test.ts`
 * documents making for the identical reason.
 */
export function assertNeverAdaptationDecision(value: never): never {
  throw new Error(`Unreachable: unhandled AdaptationDecision ${JSON.stringify(value)}`);
}
