import type { BehaviorDeltaId, ContextId } from "../contracts/ids.js";
import type { Episode } from "../contracts/episode.js";
import { ALL_EPISODE_OUTCOMES } from "../contracts/episode.js";
import type { EvidenceTally } from "../contracts/evidence-tally.js";

/**
 * `tally` — plan §3 M3's own scope, verbatim: "`tally(episodes:
 * Episode[]): EvidenceTally` — pure, dedups by `contextId`, never by
 * episode identity." This file is the whole of that scope; it selects no
 * `Intervention`/`AdaptationDecision` (that is `lib/arbitrate`, M5,
 * unbuilt), reads no `Invariant` (that is `lib/invariants`, M4, unbuilt),
 * and consults no policy constant (`MIN_DISTINCT_CONTEXTS_ADOPT`, etc.
 * belong to M5). This is pure counting, full stop.
 *
 * SIGNATURE, AND HOW IT DIFFERS FROM THE PLAN'S LITERAL TEXT: plan §3
 * writes `tally(episodes: Episode[]): EvidenceTally`. This milestone
 * ships `tally(deltaId: BehaviorDeltaId, episodes: readonly Episode[]):
 * TallyResult` instead, for two independent, concrete reasons recorded in
 * `.genesis/decisions/0003-evidence.md`:
 *
 * 1. The SAME plan section's own "what it refuses" bullet requires
 *    refusing "to crash on a hostile `episodes` array (a throwing
 *    getter, a `Proxy`)... fails closed to a typed tally-failure value,
 *    never an uncaught exception." A bare `EvidenceTally` return type has
 *    structurally no slot to carry that failure — the identical gap
 *    `agent-control-tower`'s `detectConflicts` closed the same way,
 *    returning `DetectionResult` instead of a bare `Conflict[]` for the
 *    identical reason (see that repo's `lib/conflict/detection-result.ts`
 *    header).
 * 2. `EvidenceTally.deltaId` (`lib/contracts/evidence-tally.ts`, M1,
 *    FROZEN) is a required field. An `episodes`-only signature has no
 *    honest way to populate it: a brand-new `BehaviorDelta` with zero
 *    episodes yet (a real, common, non-hostile case — arbitrate, M5,
 *    unbuilt, must be able to tally a delta with no evidence at all and
 *    get back `distinctContexts: 0`) supplies no episode to read a
 *    `deltaId` from, and a non-empty-but-hostile array must not be
 *    trusted to supply one either. Taking `deltaId` as an explicit
 *    parameter, rather than inferring it from `episodes[0]`, means this
 *    function never has to guess, and — see the `mismatched-delta-
 *    episode` failure below — it also lets `tally` catch a caller
 *    accidentally handing it another delta's episodes, which an
 *    episodes-only signature could never detect at all.
 *
 * WHY EVERY EPISODE'S OWN FIELDS ARE VALIDATED, NOT JUST SAFELY READ: the
 * plan's own bar (restated in this milestone's task) is "fails closed on
 * hostile input... a crash and a silently wrong tally are both refused,
 * not just the crash." Reading a hostile getter/Proxy without it
 * throwing is not the same as reading a WELL-FORMED value — a value that
 * reached this function via an unsafe cast (`as unknown as Episode`,
 * matching the exact residual `0001-contracts.md` Decision 1 already
 * disclosed for `AdaptationDecision`) could carry a `contextId` that
 * isn't actually a string, or an `outcome` string outside the closed
 * `"helped" | "neutral" | "harmed"` set that `episode.ts` itself declares
 * as closed ("Refuses to let `outcome` be anything outside the closed
 * three-value set"). Silently `String()`-coercing such a value, or
 * falling through a switch's default arm into whichever bucket happens
 * to be last, would be exactly the "silently wrong tally" this milestone
 * refuses — so every field is validated for both PRESENCE (extraction
 * didn't throw) and SHAPE (the right runtime type, and — for `outcome`
 * — closed-set membership) before any count is incremented.
 *
 * ORDER-INDEPENDENCE APPLIES TO FAILURE REPORTING TOO, NOT ONLY TO THE
 * SUCCESS COUNTS: `invalid-episode-outcome` and `mismatched-delta-
 * episode` both collect the full SET of offending values (deduped,
 * sorted) across the whole input rather than reporting only whichever
 * offending episode happens to be first in iteration order — so shuffling
 * a hostile episode array produces the identical `TallyResult`, error
 * included, not merely the identical result on the happy path. The one
 * exception, disclosed rather than silently left for a reader to find:
 * `hostile-episodes-input` (a throwing getter or a `Proxy` trap) reports
 * whichever exception the underlying `for...of` loop hits first, because
 * catching it necessarily halts iteration before any later element is
 * even reached — the identical, disclosed limit
 * `agent-control-tower`'s own `detect-conflicts.ts` header names for the
 * same class of check.
 */

/** The three typed ways `tally` can fail closed, discriminated by `kind` — see this file's own header for why each exists. */
export type TallyFailure =
  | {
      /** Iterating `episodes`, or reading a field off one of its elements, threw — a `Proxy` trap or a throwing getter. `message` is `String(error)` (or `error.message` for a real `Error`), kept for a human/log to read, never parsed by any code in this milestone. */
      readonly kind: "hostile-episodes-input";
      readonly message: string;
    }
  | {
      /** A safely-read `deltaId`/`contextId`/`outcome` was not even the right RUNTIME TYPE (not a string) — reached this function via a cast or an `any` value, bypassing every compile-time check `lib/contracts` provides. `fields` names every offending field, deduped and sorted, across the whole input. */
      readonly kind: "invalid-episode-shape";
      readonly fields: readonly string[];
    }
  | {
      /** A safely-read, string-typed `outcome` was not one of the closed `"helped" | "neutral" | "harmed"` values `episode.ts` declares. `values` names every distinct offending string, sorted. */
      readonly kind: "invalid-episode-outcome";
      readonly values: readonly string[];
    }
  | {
      /** An episode's own `deltaId` did not match the `deltaId` this call is tallying for — counting it anyway would silently attribute another delta's evidence to this one. `expected` is the delta this call was asked to tally; `found` names every distinct offending `deltaId` actually present, sorted. */
      readonly kind: "mismatched-delta-episode";
      readonly expected: BehaviorDeltaId;
      readonly found: readonly string[];
    };

/** `tally`'s return type — `ok: true` carries the real `EvidenceTally`; `ok: false` carries exactly which typed failure fired. Deliberately the same "typed result, not a thrown exception" shape `lib/contracts/adaptation-decision.ts`'s `FrozenIntegrityResult` and `agent-control-tower`'s `DetectionResult` both already use — re-derived independently here rather than imported, because `lib/contracts/**` is FROZEN and this milestone must not add a new export to it (scope: `lib/evidence/**` only). */
export type TallyResult =
  | { readonly ok: true; readonly tally: EvidenceTally }
  | { readonly ok: false; readonly error: TallyFailure };

const VALID_OUTCOMES: ReadonlySet<string> = new Set(ALL_EPISODE_OUTCOMES);

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The three fields this function actually reads off each `Episode`, at whatever runtime type a hostile caller handed it — `unknown`, not `Episode`'s own declared (compile-time-only) types, because the entire point of this extraction step is to check what is REALLY there. */
interface RawEpisodeFields {
  readonly deltaId: unknown;
  readonly contextId: unknown;
  readonly outcome: unknown;
}

type ExtractResult =
  | { readonly ok: true; readonly values: readonly RawEpisodeFields[] }
  | { readonly ok: false; readonly message: string };

/**
 * Reads every episode's `deltaId`/`contextId`/`outcome` inside one `try`,
 * so a throwing getter on any single element, OR the `episodes` array
 * itself being a `Proxy` that throws on iteration/`length`/indexed
 * access, is caught here rather than propagating out of `tally` as an
 * uncaught exception. Does NOT catch per-element (skip the hostile one
 * and continue) — this milestone's own bar asks for "a typed failure
 * result," i.e. tallying as a whole did not run, not a partial count
 * silently missing whichever element happened to be hostile.
 */
function safeExtract(episodes: readonly Episode[]): ExtractResult {
  try {
    const values: RawEpisodeFields[] = [];
    for (const episode of episodes) {
      const deltaIdValue = episode.deltaId;
      const contextIdValue = episode.contextId;
      const outcomeValue = episode.outcome;
      values.push({ deltaId: deltaIdValue, contextId: contextIdValue, outcome: outcomeValue });
    }
    return { ok: true, values };
  } catch (err) {
    return { ok: false, message: describeError(err) };
  }
}

/** Nothing below this point can throw — every value here already survived `safeExtract`'s `try`/`catch`, so this is ordinary, non-defensive validation and counting. */
function computeTally(deltaId: BehaviorDeltaId, values: readonly RawEpisodeFields[]): TallyResult {
  const badShapeFields = new Set<string>();
  for (const value of values) {
    if (typeof value.deltaId !== "string") badShapeFields.add("deltaId");
    if (typeof value.contextId !== "string") badShapeFields.add("contextId");
    if (typeof value.outcome !== "string") badShapeFields.add("outcome");
  }
  if (badShapeFields.size > 0) {
    return { ok: false, error: { kind: "invalid-episode-shape", fields: Array.from(badShapeFields).sort() } };
  }

  // Past this point every value.deltaId/contextId/outcome is a string —
  // narrowed structurally below via the checks above, not via a second
  // typeof check per field (nothing new could have changed it).

  const invalidOutcomes = new Set<string>();
  for (const value of values) {
    const outcome = value.outcome as string;
    if (!VALID_OUTCOMES.has(outcome)) invalidOutcomes.add(outcome);
  }
  if (invalidOutcomes.size > 0) {
    return { ok: false, error: { kind: "invalid-episode-outcome", values: Array.from(invalidOutcomes).sort() } };
  }

  const mismatched = new Set<string>();
  for (const value of values) {
    const episodeDeltaId = value.deltaId as string;
    if (episodeDeltaId !== (deltaId as unknown as string)) mismatched.add(episodeDeltaId);
  }
  if (mismatched.size > 0) {
    return { ok: false, error: { kind: "mismatched-delta-episode", expected: deltaId, found: Array.from(mismatched).sort() } };
  }

  // THE ONE REFUSAL THAT MATTERS MOST (plan §2/§3): distinctContexts is
  // the SIZE OF A SET of contextIds, never `values.length` — a replay
  // storm of any number of episodes sharing one contextId collapses to
  // exactly one entry here, by construction, not by a separate dedup step
  // bolted on afterward. A `Set` is also why this function is provably
  // order-independent: its membership does not depend on insertion order.
  const contexts = new Set<ContextId>();
  let helped = 0;
  let neutral = 0;
  let harmed = 0;
  for (const value of values) {
    contexts.add(value.contextId as ContextId);
    const outcome = value.outcome as string;
    if (outcome === "helped") helped += 1;
    else if (outcome === "neutral") neutral += 1;
    else harmed += 1; // outcome === "harmed" — the only value VALID_OUTCOMES has left, checked above.
  }

  return {
    ok: true,
    tally: { deltaId, distinctContexts: contexts.size, helped, neutral, harmed },
  };
}

/**
 * Tallies evidence for exactly one `BehaviorDeltaId`, from an `Episode[]`
 * a caller believes all bear on that same delta. Pure — never mutates
 * `episodes`, never reads a clock, never consults an `Invariant` or a
 * policy constant. Dedups strictly by `contextId` (never episode count),
 * is provably order-independent (see `__tests__/order-independence.test.ts`),
 * and fails closed — never throws — on hostile or malformed input (see
 * `__tests__/hostile-input.test.ts`).
 */
export function tally(deltaId: BehaviorDeltaId, episodes: readonly Episode[]): TallyResult {
  const extracted = safeExtract(episodes);
  if (!extracted.ok) {
    return { ok: false, error: { kind: "hostile-episodes-input", message: extracted.message } };
  }
  return computeTally(deltaId, extracted.values);
}
