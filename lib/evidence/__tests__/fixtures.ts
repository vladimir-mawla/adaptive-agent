import { behaviorDeltaId, contextId } from "../../contracts/ids.js";
import type { BehaviorDeltaId, ContextId } from "../../contracts/ids.js";
import { timestamp } from "../../contracts/timestamp.js";
import type { Episode, EpisodeOutcome } from "../../contracts/episode.js";

/** Not a real file under `lib/evidence` per plan §3's own "Files it owns" list — a test-support helper living under `__tests__/`, matching `agent-control-tower`'s own `lib/conflict/__tests__/fixtures.ts` precedent for the identical "seeded PRNG so a failure is reproducible by its printed seed" reason. */

export function episode(deltaId: BehaviorDeltaId, ctx: ContextId, outcome: EpisodeOutcome, at = "2026-09-23T00:00:00.000Z"): Episode {
  return { deltaId, contextId: ctx, outcome, observedAt: timestamp(at) };
}

export const DELTA = behaviorDeltaId("delta-escalation-aggressiveness");
export const OTHER_DELTA = behaviorDeltaId("delta-response-directness");

export const CONTEXTS = {
  a: contextId("ticket-a"),
  b: contextId("ticket-b"),
  c: contextId("ticket-c"),
  d: contextId("ticket-d"),
} as const;

/** Deterministic PRNG (mulberry32) so a failing property-based case is reproducible from its printed seed — same algorithm `agent-control-tower`'s own `fixtures.ts` uses, re-derived independently here since that file lives in a different repo, not imported across a repo boundary. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Only THREE distinct `contextId`s and THREE distinct `EpisodeOutcome`s to
 * pick from, deliberately — this is what makes the generator BELOW able
 * to actually produce the case that matters (repeated, colliding
 * `contextId`s), rather than a generator whose every id is derived from
 * fields that are always distinct (the exact failure mode this
 * milestone's own task warns a sibling shipped: "a 300-scenario property
 * test that was structurally incapable of generating the one case that
 * turned out exploitable"). A wide id pool (one fresh id per episode)
 * would make every generated scenario land at `distinctContexts ===
 * episodes.length` by construction — never once exercising the dedup
 * this function exists to prove.
 */
const CONTEXT_POOL: readonly ContextId[] = [CONTEXTS.a, CONTEXTS.b, CONTEXTS.c];
const OUTCOME_POOL: readonly EpisodeOutcome[] = ["helped", "neutral", "harmed"];

export function randomEpisode(deltaId: BehaviorDeltaId, rand: () => number): Episode {
  const ctx = CONTEXT_POOL[Math.floor(rand() * CONTEXT_POOL.length)]!;
  const outcome = OUTCOME_POOL[Math.floor(rand() * OUTCOME_POOL.length)]!;
  const at = new Date(Date.UTC(2020, 0, 1) + Math.floor(rand() * 1_000_000_000)).toISOString();
  return episode(deltaId, ctx, outcome, at);
}
