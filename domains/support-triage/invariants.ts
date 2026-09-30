import type { Invariant } from "../../lib/contracts/invariant.js";
import { invariantId } from "../../lib/contracts/ids.js";
import { createInvariantRegistry, type InvariantRegistry } from "../../lib/invariants/gate.js";
import type { AdaptableKnobId } from "./knobs.js";

/**
 * `domains/support-triage/invariants.ts` — plan §3 M6's own scope: "`auto-refund-ceiling`
 * (declared as the domain's one seeded `Invariant` — the agent may never propose raising or
 * lowering the dollar ceiling above which a refund requires human approval, no matter how many
 * tickets argue for it)."
 *
 * `DomainKnobId` — THE FULL, THREE-MEMBER KNOB VOCABULARY — LIVES HERE, NOT IN `knobs.ts`:
 * this is the one place in this domain's own setup code the string `"auto-refund-ceiling"` is
 * allowed to appear at all (`knobs.ts`'s own header and `__tests__/architecture.test.ts` both
 * enforce the reverse). `DomainKnobId = AdaptableKnobId | "auto-refund-ceiling"` imports
 * `AdaptableKnobId` FROM `knobs.ts` rather than restating it, so the two adaptable members are
 * never independently retyped in two places and drifting apart — this file depends on
 * `knobs.ts`, never the other way around (no cycle; `knobs.ts` never imports from this file).
 *
 * WHY `DomainKnobId` MUST EXIST SOMEWHERE, AND WHY HERE: `lib/invariants/gate.ts` and
 * `lib/arbitrate/arbitrate.ts` are both generic over one shared `KnobId` type parameter for a
 * `delta`/`registry` pair passed to the SAME call (`gate<KnobId,...>(delta, registry)`,
 * `arbitrate<KnobId,...>(delta, tally, gateResult, priorState, registry)`) — a registry whose
 * own `Invariant.knob` type is narrower than `AdaptableKnobId` (missing `"auto-refund-ceiling"`)
 * could never type-check against a delta that targets the refund ceiling at all, which would
 * make it impossible to even STATE the attack scenario this milestone must demonstrate (a
 * hand-built delta targeting `auto-refund-ceiling` reaching `gate`/`arbitrate` and resolving
 * `frozen`). `DomainKnobId` is the one union wide enough to type both an ordinary,
 * `knobs.ts`-proposed delta and a hand-built one targeting the protected knob, in the SAME
 * `InvariantRegistry<DomainKnobId>`.
 *
 * `SUPPORT_TRIAGE_REGISTRY` IS BUILT ONCE, HERE, AT MODULE-LOAD TIME, THROUGH
 * `createInvariantRegistry` — THE ONE LEGITIMATE CONSTRUCTION PATH `lib/invariants/gate.ts`
 * DESCRIBES ("declared once per domain at setup"): this satisfies plan §2's own registry-
 * immutability refusal ("the list of `InvariantId` values is declared once per domain at setup
 * and is not extensible at runtime from anywhere in `lib/` or `domains/`") as this domain's own
 * concrete instance of that promise — `createInvariantRegistry` defensively copies and
 * `Object.freeze`s both the array and every element (see `lib/invariants/gate.ts`'s own header),
 * so nothing under `domains/support-triage/**` (including this file's own non-test source,
 * proven by `__tests__/architecture.test.ts`) ever mutates, replaces, or extends this registry
 * after this one call runs.
 */

/** The full, three-member closed knob vocabulary this domain's engine-facing code (`scenario.ts`) actually types its deltas and registry over — the two adaptable knobs plus the one frozen one. */
export type DomainKnobId = AdaptableKnobId | "auto-refund-ceiling";

/**
 * The domain's one seeded `Invariant` (plan §3 M6, verbatim scope). `description` states the
 * real-world constraint in plain language, matching `Invariant`'s own field-level comment in
 * `lib/contracts/invariant.ts` ("a frozen, closed-list constraint the agent was *given*, never
 * one it can propose changing").
 */
export const AUTO_REFUND_CEILING_INVARIANT: Invariant<DomainKnobId> = {
  id: invariantId("inv-auto-refund-ceiling"),
  knob: "auto-refund-ceiling",
  description:
    "The dollar ceiling above which a customer refund requires human approval may never be raised or lowered by this agent's own adaptation — no matter how many tickets, or how strongly, argue that it should.",
};

/** This domain's full invariant list — exactly one entry, per plan §3 M6's own scope ("the domain's one seeded `Invariant`"). Exported as plain data (not yet a registry) so a test can assert its shape directly before it is minted. */
export const SUPPORT_TRIAGE_INVARIANTS: readonly Invariant<DomainKnobId>[] = [AUTO_REFUND_CEILING_INVARIANT];

/** The minted, frozen registry every call into `lib/invariants`/`lib/arbitrate` in this domain reads — built exactly once, at module load, through the one legitimate construction path. */
export const SUPPORT_TRIAGE_REGISTRY: InvariantRegistry<DomainKnobId> = createInvariantRegistry(SUPPORT_TRIAGE_INVARIANTS);
