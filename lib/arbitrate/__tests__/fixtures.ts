import { behaviorDeltaId, invariantId, timestamp } from "../../contracts/index.js";
import type { BehaviorDelta, EvidenceTally, Invariant } from "../../contracts/index.js";
import { createInvariantRegistry } from "../../invariants/gate.js";
import type { InvariantRegistry } from "../../invariants/gate.js";

/**
 * A LOCAL stand-in domain, matching the SAME "prove the mechanism on a
 * local stand-in, don't dishonestly widen or pre-guess a domain this
 * milestone does not own" discipline `lib/contracts/invariant.ts` and
 * `lib/invariants/__tests__/gate.test.ts` both already establish —
 * re-declared here rather than imported, since M6 (`domains/support-
 * triage/**`) does not exist yet for any test to import from.
 */
export type KnobId = "escalation-aggressiveness" | "response-directness" | "auto-refund-ceiling";

export function makeDelta(
  id: string,
  knob: KnobId,
  from: number,
  to: number,
): BehaviorDelta<KnobId, number> {
  return { id: behaviorDeltaId(id), knob, from, to, proposedAt: timestamp("2026-09-30T00:00:00Z") };
}

export function makeTally(
  deltaId: BehaviorDelta<KnobId, number>["id"],
  partial: Partial<Omit<EvidenceTally, "deltaId">> = {},
): EvidenceTally {
  return {
    deltaId,
    distinctContexts: 0,
    helped: 0,
    neutral: 0,
    harmed: 0,
    ...partial,
  };
}

export function oneInvariant(knob: KnobId, id = "refund-ceiling-invariant"): Invariant<KnobId> {
  return { id: invariantId(id), knob, description: "never adaptable" };
}

export function registryWith(...invariants: Invariant<KnobId>[]): InvariantRegistry<KnobId> {
  return createInvariantRegistry(invariants);
}

export const EMPTY_REGISTRY: InvariantRegistry<KnobId> = createInvariantRegistry([]);
