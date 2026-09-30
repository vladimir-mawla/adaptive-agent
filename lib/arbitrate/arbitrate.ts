import type { BehaviorDelta } from "../contracts/behavior-delta.js";
import type { BehaviorDeltaId, InvariantId } from "../contracts/ids.js";
import type { EvidenceTally } from "../contracts/evidence-tally.js";
import type { AdaptationDecision, FrozenDecision } from "../contracts/adaptation-decision.js";
import { assertFrozenCitesNoEvidence } from "../contracts/adaptation-decision.js";
import type { InvariantRegistry } from "../invariants/gate.js";
import { MIN_DISTINCT_CONTEXTS_ADOPT, MIN_DISTINCT_CONTEXTS_REVERT } from "./policy-constants.js";

/**
 * `arbitrate` — plan §3 M5's own scope: "combines the gate's verdict, the
 * evidence tally, and prior state into an `AdaptationDecision`." This file
 * is the whole of that scope: it reads no raw `Episode[]` (that is
 * `lib/evidence`, M3, FROZEN — this function only ever sees an already-
 * computed `EvidenceTally`), and it constructs no `InvariantRegistry`
 * (that is a domain's own setup, M6, unbuilt — this function only reads
 * one, the same read-only trust boundary `lib/invariants/gate.ts` itself
 * places on its own `registry` parameter).
 *
 * ============================================================
 * SIGNATURE DEVIATES FROM THE PLAN'S LITERAL TEXT — A FIFTH PARAMETER,
 * `invariantRegistry` — AND WHY, MATCHING THE IDENTICAL "DEVIATE,
 * DOCUMENT, DON'T SILENTLY PATCH" PRECEDENT `0003-evidence.md` AND
 * `0004-gate.md` BOTH ALREADY SET FOR THEIR OWN SIGNATURES:
 * ============================================================
 *
 * Plan §3 (M5) writes `arbitrate(delta, tally, gateResult, priorState):
 * AdaptationDecision`. `gateResult` is exactly `lib/invariants/gate.ts`'s
 * own return type, `"eligible" | "frozen"` (M4, FROZEN) — a bare two-value
 * string, carrying no information about WHICH `Invariant` matched when it
 * says `"frozen"`. But `AdaptationDecision`'s own `frozen` variant (M1,
 * FROZEN) REQUIRES `invariant: InvariantId` — a field this function must
 * populate to return a `frozen` decision at all, and the plan's own
 * 4-parameter signature gives it nothing to populate that field FROM.
 *
 * This is a real plan gap, the same kind M1 found in `KnobId`/`KnobValue`,
 * M2 found in an unreachable function name, M3 found in `tally`'s missing
 * failure slot, and M4 found in its own task brief's wrong directory —
 * flagged here, not silently guessed past.
 *
 * THE FIX: `arbitrate` takes a fifth parameter, `invariantRegistry:
 * InvariantRegistry<KnobId>` — the SAME registry object a caller already
 * had to construct and pass to `gate(delta, registry)` in order to
 * PRODUCE the `gateResult` this function receives. No new capability is
 * asked of any caller; every caller of `arbitrate` necessarily already
 * holds this value, because there is no way to have obtained a real
 * `gateResult` without it. This function re-derives which `Invariant`
 * matched `delta.knob` from that same registry, using the identical
 * `invariant.knob === delta.knob` predicate `gate` itself uses internally
 * — not a second, divergent matching rule, the SAME one, re-read from the
 * SAME registry type `lib/invariants` already exports.
 *
 * WHY NOT RE-CALL `gate(delta, invariantRegistry)` INSTEAD OF TRUSTING THE
 * PASSED-IN `gateResult`: plan §2's own `frozen`-wins refusal is meant to
 * rest on a single source of truth for "is this knob off-limits," computed
 * once, upstream, and threaded through — not recomputed redundantly at
 * every layer that needs to act on it (the same reason `priorState` below
 * is taken as an input rather than derived here from a hypothetical
 * decision history this function does not own). `gateResult` remains the
 * one value this function treats as authoritative for frozen-ness;
 * `invariantRegistry` here is used ONLY to look up a name for a verdict
 * that has already been decided, never to re-decide it. If a caller passes
 * a `gateResult` of `"frozen"` together with a registry that names no
 * invariant on `delta.knob` — an internally inconsistent pair no correct
 * caller can produce (the registry used to COMPUTE that `gateResult`
 * necessarily contains a match) — this function throws rather than
 * fabricate an `InvariantId`, the same "refuse to lie about why a decision
 * fired" standard `assertFrozenCitesNoEvidence` itself enforces at runtime
 * for the opposite direction (evidence contaminating a `frozen` value).
 *
 * ============================================================
 * `priorState` — WHAT THIS FUNCTION NEEDS TO KNOW ABOUT THE KNOB, NOT
 * ABOUT THE WHOLE SYSTEM'S HISTORY
 * ============================================================
 *
 * Plan §3 M5 must enforce "one live delta per knob" and must roll a
 * `revert` back to "the immediately-prior live value... not skip past it
 * to the original" (failure case 9). Rather than have `arbitrate` itself
 * walk a full adoption history (a materially bigger engine than this
 * milestone's scope — and the exact shape of state plan §4's failure case
 * 8 already names as deliberately NOT built here), `priorState` carries
 * exactly the two facts this one ruling needs about THIS delta's own knob,
 * computed by whatever owns adoption history (M6's domain, unbuilt):
 * whether a delta is currently live on this knob, which one, and what
 * value it replaced. See `KnobPriorState` below.
 */

/**
 * Prior state of THE ONE KNOB `delta` targets — not a system-wide map.
 * A caller scopes this to `delta.knob` before calling `arbitrate`.
 *
 * - `"vacant"` — no delta is currently live/adopted on this knob. A
 *   candidate delta is judged against the ADOPT bar.
 * - `"live"` — some delta is currently live/adopted on this knob.
 *   `liveDeltaId` says which one. If it IS `delta.id`, `delta` is under
 *   post-adoption monitoring, judged against the (lower) REVERT bar, and
 *   `replacedValue` is what a `revert` would roll the knob back to — the
 *   value immediately prior to `delta`'s own adoption, never the domain's
 *   original baseline if more than one delta has adopted since (failure
 *   case 9; it is the CALLER's job, not this function's, to track that
 *   chain and hand back the correct immediate predecessor here). If
 *   `liveDeltaId` is a DIFFERENT delta, `delta` is a second candidate
 *   racing an already-occupied knob and is held regardless of its own
 *   evidence (plan §3's "at most one live delta per knob" refusal).
 */
export type KnobPriorState<KnobValue = unknown> =
  | { readonly kind: "vacant" }
  | {
      readonly kind: "live";
      readonly liveDeltaId: BehaviorDeltaId;
      readonly replacedValue: KnobValue;
    };

function helpedMajority(tally: EvidenceTally): boolean {
  return tally.helped > tally.neutral + tally.harmed;
}

function harmedMajority(tally: EvidenceTally): boolean {
  return tally.harmed > tally.helped + tally.neutral;
}

/** Whether `tally` clears the (higher) bar for adopting a not-yet-live delta: distinct-context corroboration AND a helped-majority, both required. */
function clearsAdoptBar(tally: EvidenceTally): boolean {
  return tally.distinctContexts >= MIN_DISTINCT_CONTEXTS_ADOPT && helpedMajority(tally);
}

/** Whether `tally` clears the (lower, deliberately asymmetric) bar for reverting an already-live delta: distinct-context corroboration AND a harmed-majority, both required — lower context count than adopt, but never zero. */
function clearsRevertBar(tally: EvidenceTally): boolean {
  return tally.distinctContexts >= MIN_DISTINCT_CONTEXTS_REVERT && harmedMajority(tally);
}

/**
 * How many MORE distinct contexts would flip a not-yet-cleared tally to
 * `adopt`, floored at 0. Used for `hold.distinctContextsNeeded` in BOTH
 * cases that produce a `hold` below — see the HONEST LIMIT this single
 * number carries, documented on `arbitrate` itself: it answers only the
 * distinct-context half of "why hold," never the majority half nor the
 * knob-contention half, because `AdaptationDecision.hold` (M1, FROZEN)
 * has no field for either.
 */
function distinctContextsShortfall(tally: EvidenceTally): number {
  return Math.max(0, MIN_DISTINCT_CONTEXTS_ADOPT - tally.distinctContexts);
}

/** Looks up the `InvariantId` of whichever invariant in `registry` names `knob` — the SAME predicate `gate` itself uses, re-read from the same registry, never a second matching rule. */
function findInvariantForKnob<KnobId extends string>(
  registry: InvariantRegistry<KnobId>,
  knob: KnobId,
): InvariantId | undefined {
  for (const invariant of registry) {
    if (invariant.knob === knob) return invariant.id;
  }
  return undefined;
}

/**
 * Builds the one `frozen` decision this function ever returns, and calls
 * `assertFrozenCitesNoEvidence` on it before handing it back — THE BUILD
 * REQUIREMENT `.genesis/decisions/0001-contracts.md` records for M5,
 * honoured here, not silently skipped. The literal below has no
 * `tally`/`distinctContextsNeeded`/`revertedTo` key at all (they are all
 * `?: never` on `FrozenDecision`), so this call can never actually observe
 * a failure FOR A VALUE THIS FUNCTION ITSELF JUST BUILT — it is a
 * defence-in-depth check against a future refactor of this same function
 * (e.g. one that starts assembling `frozen` from a shared intermediate
 * object rather than a fresh literal, exactly the shape
 * `0001-contracts.md` warns is the one that tends to need a cast), proven
 * to actually fire by this milestone's own gutting experiment (see the PR
 * report) rather than trusted to fire on faith.
 */
function buildFrozenDecision(deltaId: BehaviorDeltaId, invariant: InvariantId): FrozenDecision {
  const decision: FrozenDecision = { kind: "frozen", deltaId, invariant };
  const integrity = assertFrozenCitesNoEvidence(decision);
  if (!integrity.ok) {
    throw new Error(
      `arbitrate: refusing to trust a frozen decision that failed assertFrozenCitesNoEvidence — ${JSON.stringify(
        integrity.error,
      )}`,
    );
  }
  return decision;
}

/**
 * The ruling layer. `frozen` wins over everything, unconditionally, checked
 * first: no amount or shape of `tally`/`priorState` is even inspected once
 * `gateResult === "frozen"`. Otherwise, `priorState` selects one of three
 * remaining rulings:
 *
 * - `priorState.kind === "vacant"` — candidate delta, no rival occupies the
 *   knob: `adopt` if `tally` clears `MIN_DISTINCT_CONTEXTS_ADOPT` plus a
 *   helped-majority, else `hold` with the real distinct-context shortfall.
 * - `priorState.kind === "live"` and `priorState.liveDeltaId === delta.id`
 *   — `delta` itself is the live knob value, under post-adoption
 *   monitoring: `revert` (to `priorState.replacedValue`) if `tally` clears
 *   the lower `MIN_DISTINCT_CONTEXTS_REVERT` bar plus a harmed-majority,
 *   else `adopt` continues (never `hold` — plan §2 names only `revert` or
 *   "implicitly continued `adopt`" for this branch, never a third option).
 * - `priorState.kind === "live"` and `priorState.liveDeltaId !== delta.id`
 *   — a DIFFERENT delta already occupies this knob: `delta` is held
 *   regardless of its own `tally`, enforcing "at most one live delta per
 *   knob" deterministically rather than racing two `adopt`s.
 *
 * HONEST LIMIT, STATED ONCE, AT ITS TRUE STRENGTH: `AdaptationDecision.hold`
 * (M1, FROZEN) carries exactly one number, `distinctContextsNeeded` — it
 * has no field to distinguish WHY a `hold` fired. This function can and
 * does produce `hold` for three structurally different reasons (not
 * enough distinct contexts yet; enough contexts but no helped-majority;
 * blocked by a rival live delta on the same knob) and in the second and
 * third cases `distinctContextsNeeded` is honestly `0` — the distinct-
 * context half of the bar is already cleared — while the decision is
 * still `hold`, because a different, unrepresented condition is what is
 * actually blocking it. This is not a bug introduced by this function; it
 * is a disclosed consequence of a frozen contract shape this milestone is
 * not permitted to change (`lib/contracts/**` is FROZEN — see the PR
 * report for why this is flagged as a finding, not worked around with an
 * `as`/invented field).
 *
 * A SECOND CALLER-CONSISTENCY CHECK, ADDED AFTER L4 VERIFY — `tally.deltaId
 * === delta.id` IS VERIFIED BEFORE ANYTHING ELSE RUNS: this function
 * already refuses an inconsistent `gateResult`/`invariantRegistry` pair
 * (below) rather than silently trusting it; the identical caller-
 * consistency question exists for `tally` and was, until this check was
 * added, left unverified — a caller could hand `arbitrate` one delta
 * alongside a DIFFERENT delta's `EvidenceTally`, and this function would
 * rule on it and cite the wrong evidence in the returned decision, silently.
 * `lib/evidence/tally.ts` (M3, FROZEN) takes `deltaId` as an explicit
 * parameter, separate from `episodes`, for exactly this reason — its own
 * header names the identical failure mode ("mismatched-delta-episode... a
 * caller accidentally handing it another delta's episodes") and refuses it
 * with its own typed failure. `arbitrate` sits one layer downstream of that
 * check, receiving an already-built `EvidenceTally` whose `deltaId` field
 * it had, until now, never actually read — this closes that gap, throwing
 * rather than fabricate or silently accept a mismatched tally, the same
 * "refuse to lie about what a decision is based on" standard this function
 * already applies to the `gateResult`/`invariantRegistry` pair.
 */
export function arbitrate<KnobId extends string = string, KnobValue = unknown>(
  delta: BehaviorDelta<KnobId, KnobValue>,
  tally: EvidenceTally,
  gateResult: "eligible" | "frozen",
  priorState: KnobPriorState<KnobValue>,
  invariantRegistry: InvariantRegistry<KnobId>,
): AdaptationDecision<KnobValue> {
  if (tally.deltaId !== delta.id) {
    throw new Error(
      `arbitrate: tally.deltaId (${JSON.stringify(tally.deltaId)}) does not match delta.id (${JSON.stringify(
        delta.id,
      )}) — caller handed this delta another delta's evidence.`,
    );
  }

  if (gateResult === "frozen") {
    const invariant = findInvariantForKnob(invariantRegistry, delta.knob);
    if (invariant === undefined) {
      throw new Error(
        `arbitrate: gateResult was "frozen" for knob ${JSON.stringify(
          delta.knob,
        )} but no invariant in the supplied registry names that knob — caller passed an inconsistent gateResult/invariantRegistry pair.`,
      );
    }
    return buildFrozenDecision(delta.id, invariant);
  }

  // gateResult === "eligible" past this point.

  if (priorState.kind === "live") {
    if (priorState.liveDeltaId === delta.id) {
      if (clearsRevertBar(tally)) {
        return { kind: "revert", deltaId: delta.id, tally, revertedTo: priorState.replacedValue };
      }
      return { kind: "adopt", deltaId: delta.id, tally };
    }
    // A different delta already lives on this knob — one-live-delta-per-knob,
    // enforced regardless of how strong this candidate's own tally is.
    return { kind: "hold", deltaId: delta.id, tally, distinctContextsNeeded: distinctContextsShortfall(tally) };
  }

  // priorState.kind === "vacant" — an ordinary not-yet-adopted candidate.
  if (clearsAdoptBar(tally)) {
    return { kind: "adopt", deltaId: delta.id, tally };
  }
  return { kind: "hold", deltaId: delta.id, tally, distinctContextsNeeded: distinctContextsShortfall(tally) };
}
