import type { BehaviorDelta } from "../../lib/contracts/behavior-delta.js";
import { behaviorDeltaId } from "../../lib/contracts/ids.js";
import { timestamp } from "../../lib/contracts/timestamp.js";

/**
 * `domains/support-triage/knobs.ts` — plan §3 M6's own scope: the support-triage agent's
 * *adaptable* behavior vocabulary. `.genesis/PLAN.md` §3 (M6) names three knobs total
 * (`escalation-aggressiveness`, `response-directness`, `auto-refund-ceiling`), but its own
 * "what it refuses" bullet is explicit that only two of the three belong in THIS file:
 * "to register `auto-refund-ceiling` as an adaptable knob anywhere in this domain's own setup
 * code (it is only ever named inside `invariants.ts`, never inside `knobs.ts`)."
 *
 * THE REFUSAL IS ENFORCED TWO WAYS, NOT ONE:
 * 1. TYPE-LEVEL — `AdaptableKnobId` is a two-member closed union that does not include
 *    `"auto-refund-ceiling"` at all; `proposeDelta`'s own parameter type is `AdaptableKnobId`,
 *    so passing the invariant-protected knob's literal name to this file's own proposal
 *    function is a compile error, not a runtime check (`__tests__/knobs.test.ts` proves this
 *    with `@ts-expect-error`).
 * 2. SOURCE-SCAN — `__tests__/architecture.test.ts` greps this file's own CODE (comments
 *    stripped first, the identical discipline every other `architecture.test.ts` in this repo
 *    already uses, e.g. `lib/arbitrate`'s override scan) for the substring
 *    `"auto-refund-ceiling"` and fails if it is ever *registered* there — a literal union
 *    member, a case label, an object key. A comment disclosing, in prose, why the knob is
 *    excluded (this header) is not what the plan's refusal is aimed at, and is this account's
 *    own standing discipline to prefer over a silent omission.
 *
 * `KnobValue = number` FOR BOTH KNOBS HERE, A DOMAIN FACT `lib/contracts` DELIBERATELY LEFT
 * OPEN (see `lib/contracts/behavior-delta.ts`'s own header: "`KnobValue = unknown` is the
 * honest default... domain-specific fact M6 owns"): `escalation-aggressiveness` is modeled as
 * a bounded float in `[0, 1]` (0 = never escalate past the first tier, 1 = escalate
 * immediately), `response-directness` likewise a bounded float in `[0, 1]` (0 = maximally
 * hedged/apologetic phrasing, 1 = maximally direct). Neither bound is enforced by a runtime
 * check in this file — this milestone's scope is the closed KNOB-NAME vocabulary and the
 * proposal shape, not a validated value range, and no plan bullet asks for one. Choosing the
 * SAME value type (`number`) for both knobs — rather than, say, a string enum for one of
 * them — is what lets both share one `AdaptableKnobId`/`number` instantiation of
 * `BehaviorDelta`/`arbitrate`/`gate` rather than needing a per-knob generic split; see
 * `.genesis/decisions/0006-domain.md` for the full reasoning and the one place this
 * uniformity was weighed against a closer domain model and decided against.
 *
 * `proposeDelta` RETURNS `BehaviorDelta<AdaptableKnobId, number>`, NOT `BehaviorDelta<DomainKnobId,
 * number>`: this file never imports `DomainKnobId` from `invariants.ts` at all — doing so would
 * create exactly the import cycle this domain's own module-graph test refuses (`invariants.ts`
 * imports `AdaptableKnobId` FROM this file to build its wider union; the reverse import would be
 * a cycle). `BehaviorDelta`'s `knob` field is `readonly`, so a `BehaviorDelta<AdaptableKnobId,
 * number>` is structurally assignable wherever a `BehaviorDelta<DomainKnobId, number>` is
 * expected (a narrower union widening into a wider one, checked by
 * `__tests__/knobs.test.ts`) — `scenario.ts` is where that widening actually happens, at the
 * one place this domain composes a proposed delta with `lib/invariants`/`lib/arbitrate`.
 */

/** The closed, two-member set of knobs this domain will ever let an ordinary caller *propose a change to* — `auto-refund-ceiling` is never a member, by construction, not by a filter applied elsewhere. */
export type AdaptableKnobId = "escalation-aggressiveness" | "response-directness";

/** Every legal `AdaptableKnobId`, for tests and the demo script that need to enumerate the closed set without re-typing it. */
export const ADAPTABLE_KNOB_IDS: readonly AdaptableKnobId[] = ["escalation-aggressiveness", "response-directness"];

/** Plain, unbranded input to `proposeDelta` — a caller supplies raw strings/numbers; this function owns minting the branded `BehaviorDeltaId`/`Timestamp`. */
export interface ProposeDeltaInput {
  readonly id: string;
  readonly knob: AdaptableKnobId;
  readonly from: number;
  readonly to: number;
  readonly proposedAt: string;
}

/**
 * The ONE legitimate way this domain's own setup code proposes a candidate change to an
 * adaptable knob. `input.knob: AdaptableKnobId` is the compile-time refusal described above —
 * there is no overload, no optional escape parameter, and no string-widening path in this
 * function's own signature that would let `"auto-refund-ceiling"` reach it.
 */
export function proposeDelta(input: ProposeDeltaInput): BehaviorDelta<AdaptableKnobId, number> {
  return {
    id: behaviorDeltaId(input.id),
    knob: input.knob,
    from: input.from,
    to: input.to,
    proposedAt: timestamp(input.proposedAt),
  };
}
