import type { BehaviorDeltaId, ContextId } from "./ids.js";
import type { Timestamp } from "./timestamp.js";

/**
 * `EpisodeOutcome` — closed 3-value enum, deliberately NOT a numeric score
 * (plan §2): `"helped" | "neutral" | "harmed"`. "**Refuses** to let
 * `outcome` be anything outside the closed three-value set — no numeric
 * score standing in for it." Named as its own exported type (the plan's
 * own bullet inlines it as a literal union on `Episode.outcome` without
 * naming it separately) so `__tests__/episode.test.ts` and any later
 * milestone's exhaustive switch have one symbol to import, matching how
 * `agent-control-tower`'s `ResourceClaimMode` and `ConflictSeverity` are
 * each named on their own even though they, too, first appear inline in a
 * containing type's bullet.
 *
 * No `assertNeverEpisodeOutcome` helper: nothing in this milestone
 * exhaustively switches over all three values — that is `lib/evidence`'s
 * job (M3, unbuilt), matching `Corroboration`'s own documented choice not
 * to export an unused exhaustiveness helper before a real consumer needs
 * one.
 */
export type EpisodeOutcome = "helped" | "neutral" | "harmed";

/** Every legal `EpisodeOutcome`, for tests that need to enumerate the closed set. Not consumed by any production code in this milestone. */
export const ALL_EPISODE_OUTCOMES: readonly EpisodeOutcome[] = ["helped", "neutral", "harmed"];

/**
 * `Episode` — one independent occurrence bearing on a `BehaviorDelta`,
 * either while it is a candidate (pre-adoption trial) or while it is live
 * (post-adoption monitoring) (plan §2): `{ deltaId, contextId, outcome,
 * observedAt }`, exactly the four fields the plan names.
 *
 * `contextId: ContextId` IS THE UNIT OF INDEPENDENCE, NOT `Episode`'S OWN
 * IDENTITY: plan §2 is explicit that this is "the single most important
 * refusal in this project" (see M3, unbuilt) — `EvidenceTally.
 * distinctContexts` counts unique `contextId`s, never episode count. This
 * file only carries the field M3's `tally()` will dedup on; it computes
 * nothing itself (no engine logic in M1, per this milestone's own scope).
 *
 * NO GENERIC `KnobId`/`KnobValue` HERE, UNLIKE `Invariant`/`BehaviorDelta`:
 * an `Episode` references a delta only by its opaque `BehaviorDeltaId`,
 * never by the delta's own `knob`/`from`/`to` — so it carries no
 * domain-shaped type parameter to thread through.
 */
export interface Episode {
  readonly deltaId: BehaviorDeltaId;
  readonly contextId: ContextId;
  readonly outcome: EpisodeOutcome;
  readonly observedAt: Timestamp;
}
