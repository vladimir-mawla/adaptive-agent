import type { BehaviorDeltaId } from "./ids.js";

/**
 * `EvidenceTally` — `{ deltaId, distinctContexts, helped, neutral, harmed }`
 * (plan §2), computed by `lib/evidence` (M3, unbuilt) from an `Episode[]`.
 * This file fixes only the SHAPE of that computation's output — M1 builds
 * no engine logic, so nothing here computes a tally from real episodes.
 *
 * `distinctContexts` IS A PLAIN `number`, NOT DERIVED FROM `helped +
 * neutral + harmed`: the plan is explicit these can diverge on purpose —
 * "a delta with 200 episodes, all from the same `contextId`, has
 * `distinctContexts: 1`" while `helped + neutral + harmed` for that same
 * delta could be 200. Modeling `distinctContexts` as a derived/computed
 * property (rather than its own stored field) would either force it to
 * silently equal the episode-count sum (exactly the conflation the plan
 * refuses) or require a second, redundant source of truth — a plain field
 * that M3's `tally()` sets directly from `new Set(episodes.map(e =>
 * e.contextId)).size` is the one shape that cannot accidentally collapse
 * the two numbers into each other.
 *
 * NO GENERIC `KnobId`/`KnobValue` HERE: like `Episode`, a tally is keyed
 * only by the opaque `BehaviorDeltaId` it summarizes evidence for, never
 * by the delta's own knob or value — nothing here is domain-shaped.
 *
 * NO INVARIANT BETWEEN THE FOUR COUNTS ENFORCED AT THE TYPE LEVEL (e.g.
 * `helped + neutral + harmed >= distinctContexts` is not, and cannot be,
 * a compile-time check on four independent `number` fields) — that
 * consistency is M3's `tally()` to uphold as a runtime property of its
 * own output, not something this plain data shape can prove about itself.
 */
export interface EvidenceTally {
  readonly deltaId: BehaviorDeltaId;
  readonly distinctContexts: number;
  readonly helped: number;
  readonly neutral: number;
  readonly harmed: number;
}
