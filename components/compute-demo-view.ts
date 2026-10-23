import type { BehaviorDelta } from "../lib/contracts/behavior-delta.js";
import { behaviorDeltaId, contextId } from "../lib/contracts/ids.js";
import { timestamp } from "../lib/contracts/timestamp.js";
import type { Episode, EpisodeOutcome } from "../lib/contracts/episode.js";
import { ALL_EPISODE_OUTCOMES } from "../lib/contracts/episode.js";
import type { AdaptationDecision } from "../lib/contracts/adaptation-decision.js";
import type { KnobPriorState } from "../lib/arbitrate/arbitrate.js";
import { proposeDelta } from "../domains/support-triage/knobs.js";
import type { DomainKnobId } from "../domains/support-triage/invariants.js";
import { evaluateDelta } from "../domains/support-triage/scenario.js";

/**
 * `components/compute-demo-view.ts` — the ONE view-model function M8 owns (plan §3, M8: "Files
 * it owns... `components/compute-demo-view.ts`"). Every `AdaptationDecision` this file produces
 * is the return value of a call to `domains/support-triage/scenario.ts`'s `evaluateDelta` — the
 * glue over `lib/evidence.tally` -> `lib/invariants.gate` -> `lib/arbitrate.arbitrate` that
 * `scripts/demo-triage.ts` already uses, not a second, independently-written copy of it (the only
 * assignments to `decision` below are `mustEvaluate(...)` calls, and the only thing this file
 * imports from `lib/arbitrate` is the `KnobPriorState` type). Nothing in this file hardcodes a string describing what the
 * engine "would" rule; the rendered text is pinned against real decisions in
 * `__tests__/AdaptiveAgentDemo.test.tsx`.
 *
 * PURE AND SYNCHRONOUS, NO HIDDEN STATE: `computeKnobView` reads only its own arguments — no
 * clock, no randomness, and no module-level mutable state (grep-checked, outside comments: no
 * `Date`, `Math.random` or module-level `let`/`var` in this file). `__tests__/compute-demo-view.test.ts`
 * pins that two calls on one input history return deep-equal views and that the history is not
 * modified. There is no `useEffect`, `useCallback`, `useMemo`, `useRef`, timer, `Promise` or
 * `async` in the code of this file or of `AdaptiveAgentDemo.tsx` (grep-checked, outside comments),
 * and `lib/**` and `domains/**` contain no `async`, `await`, `Promise` or timers (grep-checked), so deriving the whole view fresh
 * from `(knobId, episodeLog)` on every render leaves no stored derived value for a re-render to
 * leave stale (see `.genesis/decisions/0008-demo.md`, Decision 1, for the stale-derived-state
 * failure this avoids).
 *
 * THE TWO-PHASE MODEL, INHERITED FROM `scenario.ts`, NOT REINVENTED: `lib/arbitrate.arbitrate`
 * takes exactly one `tally` and one `priorState` per call and has no memory of a delta's own
 * evidence history (`scenario.ts`'s own header names this same gap and records the domain's
 * fix: each phase gets its own fresh episode pool). This file makes the IDENTICAL domain-level
 * choice, for the identical reason: every injected episode for a knob is replayed, in the order
 * it was injected, against a phase that starts `"trial"` (`priorState: vacant`) and flips to
 * `"live"` (`priorState: live`, rolling back to `delta.from`) the instant a trial-phase
 * evaluation first resolves `adopt` — the episode that tipped the balance stays in the trial
 * pool (it is what caused the adoption); every episode injected after that point goes into a
 * separate, fresh `monitoring` pool, matching `ESCALATION_TRIAL_EPISODES` /
 * `ESCALATION_MONITORING_EPISODES`'s own separation in `scenario.ts`. A knob whose delta targets
 * the invariant-protected `auto-refund-ceiling` knob stays `"trial"` in every history the tests
 * drive (up to 10,000 episodes): `lib/invariants.gate` gives it a `frozen` verdict, and in
 * `lib/arbitrate/arbitrate.ts` (lines 244-262), after its `tally.deltaId` consistency check,
 * `gateResult === "frozen"` is ruled on before `priorState` or any of the tally's counts are read
 * (`evaluateDelta` itself computes the tally first) — so the phase fold below, which flips only on
 * an `adopt` decision, receives none for this knob in those histories. That is the headline
 * contrast this milestone exists to make reachable in the UI.
 *
 * WHY THIS FILE REACHES NONE OF `arbitrate`'S THROW SITES (see `.genesis/decisions/
 * 0008-demo.md`, Decision 3, for the full argument): `lib/arbitrate/arbitrate.ts` contains
 * three `throw new Error` sites. Two are caller-inducible: `tally.deltaId !== delta.id`, and
 * `gateResult === "frozen"` with no invariant on `delta.knob` in the supplied registry. The third
 * (`buildFrozenDecision`) is a defence-in-depth guard on a literal the function has just built;
 * `assertFrozenCitesNoEvidence` cannot fail on it (a reading of `arbitrate.ts` lines 170-180: the
 * literal carries none of the fields the check looks for), so no caller input reaches it. This
 * file reaches none of the three: it never builds a `tally` or a `gateResult` by hand at all (it
 * imports no `tally`, `gate` or `arbitrate` function) -- it calls `evaluateDelta` (`scenario.ts`, FROZEN), which
 * tallies with `delta.id` itself and gates against this domain's one `SUPPORT_TRIAGE_REGISTRY`
 * (`scenario.ts` lines 82-86) -- so the pair `arbitrate` receives is consistent BY CONSTRUCTION,
 * not by a runtime check this file adds on top. The three
 * `BehaviorDelta` values below are fixed module-level constants with distinct, hardcoded ids;
 * nothing in `AdaptiveAgentDemo.tsx` lets a person type or choose a delta id, so by construction
 * no injected input is paired with another delta's episodes (the sweep test pins the delta ids of
 * the episodes the view retains, and the engine-spy test those passed to `evaluateDelta`, for the
 * histories they drive).
 *
 * A FOURTH THROW SITE EXISTS, AND IT IS THIS FILE'S OWN: `mustEvaluate`, below, throws if
 * `evaluateDelta` reports that `lib/evidence.tally` refused an episode set. That is reachable only
 * if `tally` refuses -- which, by construction, the rendered controls do not cause (the outcome
 * comes from a closed `<select>`, any typed context id is still a string, and every episode is
 * built here with the knob's own delta id; a fixed adversarial corpus in the test suite is a
 * regression pin on this, not a proof). It is deliberately not caught: fabricating a decision after the engine
 * refused would be the failure this milestone exists to avoid.
 */

/** The three knobs this demo exposes a panel for — the full `DomainKnobId` vocabulary (two adaptable, one invariant-protected), typed with `DomainKnobId`, so a knob name outside `invariants.ts`'s own union fails typecheck. */
export const DEMO_KNOB_IDS: readonly DomainKnobId[] = ["escalation-aggressiveness", "response-directness", "auto-refund-ceiling"];

/** Every legal `EpisodeOutcome` a person can pick in the injection form, re-exported so `AdaptiveAgentDemo.tsx` never hardcodes the closed set independently of `lib/contracts/episode.ts`. */
export const INJECTABLE_OUTCOMES: readonly EpisodeOutcome[] = ALL_EPISODE_OUTCOMES;

/** One raw, unbranded episode input as a person actually types/selects it in the form — minting into a real `Episode` happens only inside this file, never in the component. */
export interface RawEpisodeInput {
  readonly contextId: string;
  readonly outcome: EpisodeOutcome;
}

/**
 * This demo's three fixed candidate deltas, one per knob, proposed through the SAME sanctioned
 * entry points `domains/support-triage` itself uses — `proposeDelta` for the two adaptable
 * knobs (its own parameter type makes handing it `"auto-refund-ceiling"` a compile error, see
 * `knobs.ts`'s header), and a direct `BehaviorDelta<DomainKnobId, number>` literal for the
 * invariant-protected knob, built the identical way `scenario.ts`'s own `REFUND_CEILING_DELTA`
 * is (bypassing `proposeDelta` entirely, so the protected knob's `frozen` ruling is exercised here
 * on a hand-built delta). Distinct ids from `scenario.ts`'s own fixtures, deliberately — this
 * demo's state is independent of the `npm run demo:triage` script's fixture data and shares no id
 * with it (`demo-delta-*` here, `delta-*` there).
 */
export const DEMO_DELTAS: { readonly [K in DomainKnobId]: BehaviorDelta<DomainKnobId, number> } = {
  "escalation-aggressiveness": proposeDelta({
    id: "demo-delta-escalation-aggressiveness",
    knob: "escalation-aggressiveness",
    from: 0.5,
    to: 0.8,
    proposedAt: "2026-09-30T00:00:00Z",
  }),
  "response-directness": proposeDelta({
    id: "demo-delta-response-directness",
    knob: "response-directness",
    from: 0.4,
    to: 0.6,
    proposedAt: "2026-09-30T00:00:00Z",
  }),
  "auto-refund-ceiling": {
    id: behaviorDeltaId("demo-delta-auto-refund-ceiling"),
    knob: "auto-refund-ceiling",
    from: 500,
    to: 750,
    proposedAt: timestamp("2026-09-30T00:00:00Z"),
  },
};

const VACANT_PRIOR_STATE: KnobPriorState<number> = { kind: "vacant" };

/**
 * Turns one injected `RawEpisodeInput` into a real `Episode` for `delta`. `observedAt` is a
 * synthetic, strictly increasing timestamp derived only from `sequence` (the episode's own
 * position in this knob's full injection order) — not `Date.now()` — so this function reads no
 * clock and the same sequence of inputs yields the same `Episode[]`, which is what lets
 * `computeKnobView` be called fresh on every render. `lib/evidence/tally.ts` contains no
 * occurrence of `observedAt` (grep-checked), and `tests/failures/08-no-time-decay.test.ts` pins
 * that substituting episodes dated years apart changes nothing but `observedAt`, so this
 * synthetic value is not an input to the tally.
 */
function toEpisode(deltaId: ReturnType<typeof behaviorDeltaId>, input: RawEpisodeInput, sequence: number): Episode {
  const minute = Math.floor(sequence / 60);
  const second = sequence % 60;
  const iso = `2026-09-30T00:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}Z`;
  return {
    deltaId,
    contextId: contextId(input.contextId),
    outcome: input.outcome,
    observedAt: timestamp(iso),
  };
}

export type DemoPhase = "trial" | "live";

/** One knob panel's full, derived view: `knobId` and `delta` are fixed constants, `trialEpisodes`/`monitoringEpisodes` are built only from the input history, `phase` is derived from engine decisions, and `decision` is a real `evaluateDelta` return value. */
export interface KnobView {
  readonly knobId: DomainKnobId;
  readonly delta: BehaviorDelta<DomainKnobId, number>;
  readonly phase: DemoPhase;
  readonly decision: AdaptationDecision<number>;
  readonly trialEpisodes: readonly Episode[];
  readonly monitoringEpisodes: readonly Episode[];
}

/**
 * Replays `inputs` (the full, ordered history of what a person injected against this knob) and
 * derives this knob's current `KnobView` from scratch. Called fresh on every render with
 * whatever `inputs` the component's own state currently holds — no incremental/cached phase is
 * kept in this file (no module-level mutable state, grep-checked), so no derived value is stored
 * for `inputs` to leave stale.
 *
 * Throws only if `evaluateDelta` refuses (see `mustEvaluate`) or `arbitrate` itself throws —
 * which, per this file's own header, does not happen here by construction: `delta` is one of the
 * three fixed `DEMO_DELTAS`, and every episode built from it below carries that same `delta.id`.
 */
function liveOn(delta: BehaviorDelta<DomainKnobId, number>): KnobPriorState<number> {
  return { kind: "live", liveDeltaId: delta.id, replacedValue: delta.from };
}

function mustEvaluate(
  delta: BehaviorDelta<DomainKnobId, number>,
  episodes: readonly Episode[],
  priorState: KnobPriorState<number>,
): AdaptationDecision<number> {
  const result = evaluateDelta(delta, episodes, priorState);
  if (!result.ok) {
    // lib/evidence.tally only refuses malformed input (hostile getters, wrong runtime types, a
    // mismatched deltaId) — none of which this file's own construction can produce (see this
    // file's header: every episode here is built with this SAME delta's own id, and every call
    // goes through evaluateDelta, never a hand-assembled tally/gateResult pair). Surfaced as a
    // thrown error, visibly, rather than silently fabricating a decision — matching this
    // project's own "fail closed, don't paper over" standard; `AdaptiveAgentDemo.tsx` does not
    // catch this because, by construction, no input the rendered form can submit reaches it.
    throw new Error(`compute-demo-view: evaluateDelta unexpectedly refused this knob's own episodes — ${result.reason}`);
  }
  return result.decision;
}

/**
 * Replays `inputs` one at a time, in order, and returns the decision produced at the LAST step
 * actually evaluated — never a separate, final re-evaluation computed after the fact. This
 * matters concretely at the exact episode that tips a trial-phase `hold` into `adopt`: that
 * episode's own evaluation (against the full trial pool, under `vacant`) IS the current
 * decision from that point forward, until the next post-adoption episode arrives — re-evaluating
 * afterward against an as-yet-empty `monitoring` pool under `live` would silently replace a real,
 * evidence-bearing `adopt` with a hollow one (zero tally) that happens to share the same `kind`.
 * `scripts/demo-triage.ts` avoids this same trap by construction — it prints a fresh decision
 * after every individual episode is added, never a single decision recomputed once at the end —
 * and this function follows the identical discipline.
 */
export function computeKnobView(knobId: DomainKnobId, inputs: readonly RawEpisodeInput[]): KnobView {
  const delta = DEMO_DELTAS[knobId];
  let phase: DemoPhase = "trial";
  const trialEpisodes: Episode[] = [];
  const monitoringEpisodes: Episode[] = [];
  let decision: AdaptationDecision<number> = mustEvaluate(delta, trialEpisodes, VACANT_PRIOR_STATE);

  for (let sequence = 0; sequence < inputs.length; sequence += 1) {
    const raw = inputs[sequence];
    if (raw === undefined) continue; // noUncheckedIndexedAccess — inputs.length bounds sequence, so this can only fire for a sparse array, which the component does not build.
    const episode = toEpisode(delta.id, raw, sequence);
    if (phase === "trial") {
      trialEpisodes.push(episode);
      decision = mustEvaluate(delta, trialEpisodes, VACANT_PRIOR_STATE);
      if (decision.kind === "adopt") {
        phase = "live";
      }
    } else {
      monitoringEpisodes.push(episode);
      decision = mustEvaluate(delta, monitoringEpisodes, liveOn(delta));
    }
  }

  return {
    knobId,
    delta,
    phase,
    decision,
    trialEpisodes,
    monitoringEpisodes,
  };
}
