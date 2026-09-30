import { contextId, behaviorDeltaId } from "../../lib/contracts/ids.js";
import type { BehaviorDeltaId } from "../../lib/contracts/ids.js";
import { timestamp } from "../../lib/contracts/timestamp.js";
import type { Episode, EpisodeOutcome } from "../../lib/contracts/episode.js";
import type { KnobPriorState } from "../../lib/arbitrate/arbitrate.js";

/**
 * Shared, non-load-bearing helpers for `tests/failures/**` — building real
 * `Episode`/`KnobPriorState` values the same plain way every other test
 * suite in this repo already does (`domains/support-triage/scenario.ts`'s
 * own local `episode()` helper, `lib/arbitrate/__tests__/fixtures.ts`).
 * Nothing here is engine logic: it mints branded ids and builds plain data,
 * exactly the shape a real caller (a ticketing integration, in a fuller
 * system) would hand to `tally`/`evaluateDelta`.
 */

/** No delta is live on the knob yet — the ordinary starting `KnobPriorState` for a not-yet-adopted candidate. */
export const VACANT: KnobPriorState<number> = { kind: "vacant" };

/** `delta` is the live value on its knob, replacing `replacedValue` — post-adoption monitoring. */
export function liveState(liveDeltaId: BehaviorDeltaId, replacedValue: number): KnobPriorState<number> {
  return { kind: "live", liveDeltaId, replacedValue };
}

export function episode(
  deltaId: BehaviorDeltaId,
  ctx: string,
  outcome: EpisodeOutcome,
  observedAt = "2026-01-01T00:00:00Z",
): Episode {
  return { deltaId, contextId: contextId(ctx), outcome, observedAt: timestamp(observedAt) };
}

/** `count` episodes, all naming the SAME `contextId` — a same-context replay storm. */
export function sameContextStorm(
  deltaId: BehaviorDeltaId,
  ctx: string,
  outcome: EpisodeOutcome,
  count: number,
): Episode[] {
  return Array.from({ length: count }, () => episode(deltaId, ctx, outcome));
}

/** `count` episodes, each naming a DISTINCT `contextId` (`${prefix}-0`, `${prefix}-1`, ...) — genuine, independent corroboration at scale. */
export function distinctContextEpisodes(
  deltaId: BehaviorDeltaId,
  prefix: string,
  outcome: EpisodeOutcome,
  count: number,
): Episode[] {
  return Array.from({ length: count }, (_, i) => episode(deltaId, `${prefix}-${i}`, outcome));
}

export function id(raw: string): BehaviorDeltaId {
  return behaviorDeltaId(raw);
}

/**
 * Five ways to spell the SAME real ticket id, exercising the full breadth
 * of `lib/contracts/ids.ts`'s "opaque token, exact string equality" design
 * (that file's own header: "NO PARSERS") across all four spelling-drift
 * mechanisms `.genesis/decisions/0003-evidence.md` names concretely —
 * case, whitespace, an invisible zero-width character, and Unicode
 * normalization form. Each is visually or semantically "the same ticket"
 * to a human reading it and is confirmed (see
 * `06-context-id-spelling-drift.test.ts`'s own first assertion, a direct
 * `===`/`Set` check with no `lib/evidence` involved yet) to be five
 * DISTINCT JavaScript strings.
 */
export const SAME_TICKET_FIVE_SPELLINGS = {
  plain: "tck-café-9001",
  upperCase: "TCK-CAFÉ-9001",
  trailingWhitespace: "tck-café-9001 ",
  zeroWidthSuffix: "tck-café-9001​",
  // The visually identical ticket id, but with the final "é" written as
  // NFD (a plain "e" + a combining acute accent, U+0301) rather than the
  // single precomposed NFC codepoint "é" (U+00E9) every other spelling
  // above uses — two different codepoint sequences that render identically
  // and are canonically equivalent Unicode, but are NOT `===` in plain JS.
  nfdVariant: "tck-café-9001",
} as const;
