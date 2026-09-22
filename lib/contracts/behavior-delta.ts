import type { BehaviorDeltaId } from "./ids.js";
import type { Timestamp } from "./timestamp.js";

/**
 * `BehaviorDelta` — a candidate change to one knob's value (plan §2):
 * `{ id, knob: KnobId, from, to, proposedAt }`, exactly the five fields
 * the plan names.
 *
 * `KnobId` IS GENERIC HERE, FOR THE SAME REASON AND AT THE SAME HONEST
 * LIMIT documented in `invariant.ts`'s header — see that file rather than
 * repeating the full reasoning. In short: the concrete literal union of
 * knob names belongs to a domain (M6, unbuilt), not to this milestone;
 * `BehaviorDelta<KnobId extends string = string, ...>`'s unparameterized
 * default accepts free text, and the refusal is a property of a domain's
 * own narrowed instantiation, proven on a local stand-in in
 * `__tests__/behavior-delta.test.ts`.
 *
 * `KnobValue` IS ALSO GENERIC, FOR A RELATED BUT DISTINCT GAP THIS FILE
 * FLAGS EXPLICITLY: the plan's §2 code block for `AdaptationDecision`
 * references a `KnobValue` type directly (`revertedTo: KnobValue`), but
 * §2's own "Supporting types" bullets never define one — no bullet for
 * `BehaviorDelta` states what type `from`/`to` actually are either, only
 * that "a delta that doesn't state what it's changing *from* cannot be
 * checked for direction or magnitude later." Whether a knob's value is a
 * number (`auto-refund-ceiling`'s dollar figure), a bounded float
 * (`escalation-aggressiveness`), or something else again is exactly the
 * kind of domain-specific fact M6 owns and this milestone does not
 * pre-guess — recorded as a plan gap in `.genesis/decisions/
 * 0001-contracts.md` rather than silently resolved by picking `number` and
 * hoping every future knob fits it. `KnobValue = unknown` is the honest
 * default: "some value type a domain will fix," not a guess at which one.
 *
 * `AdaptationDecision`'s own `KnobValue` type parameter (adaptation-
 * decision.ts) is threaded through so a domain instantiates BOTH
 * `BehaviorDelta<K, V>` and `AdaptationDecision<V>` with the SAME `V` —
 * `revertedTo`'s type must match `from`/`to`'s type, since a revert rolls
 * a knob back to a value that same knob's own deltas produced.
 *
 * REFUSES TO COMPILE WITHOUT BOTH `from` AND `to`: both fields are
 * required (no `?`), proven in `__tests__/behavior-delta.test.ts` with
 * `@ts-expect-error` on an object literal omitting each one.
 */
export interface BehaviorDelta<KnobId extends string = string, KnobValue = unknown> {
  readonly id: BehaviorDeltaId;
  readonly knob: KnobId;
  readonly from: KnobValue;
  readonly to: KnobValue;
  readonly proposedAt: Timestamp;
}
