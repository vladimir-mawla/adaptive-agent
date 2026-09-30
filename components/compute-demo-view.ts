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
 * it owns... `components/compute-demo-view.ts`"). Every value this file produces comes from a
 * real call into the frozen engine chain (`lib/evidence.tally` -> `lib/invariants.gate` ->
 * `lib/arbitrate.arbitrate`, composed by `domains/support-triage/scenario.ts`'s own
 * `evaluateDelta` — the identical glue `scripts/demo-triage.ts` already uses, not a second,
 * independently-written copy of it). Nothing in this file hardcodes a string describing what
 * the engine "would" rule — every `AdaptationDecision` rendered by `AdaptiveAgentDemo.tsx` is a
 * real return value read off a real `evaluateDelta` call made right here, during render.
 *
 * PURE, SYNCHRONOUS, NO HIDDEN STATE: `computeKnobView` is a plain function of its own
 * arguments — the same ordered list of injected episodes in, the same `KnobView` out, always.
 * No `useEffect`, `useCallback`, `setTimeout`, `Promise`, or any other asynchrony anywhere in
 * this file or in `AdaptiveAgentDemo.tsx` — `lib/**` is entirely synchronous and pure, so
 * deriving the whole view fresh from `(knobId, episodeLog)` on every render is simplest and
 * safest (see this milestone's own ADR, `.genesis/decisions/0008-demo.md`, "the traps" section,
 * for the sibling precedent this follows).
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
 * the invariant-protected `auto-refund-ceiling` knob never leaves `"trial"` — `lib/invariants.gate`
 * rules it `frozen` unconditionally, before `priorState` is even consulted (see
 * `lib/arbitrate/arbitrate.ts`'s own `gateResult === "frozen"` check, which runs first) — so no
 * amount of injected evidence ever flips its phase, which is the headline contrast this
 * milestone exists to make reachable in the UI.
 *
 * WHY THIS FILE CANNOT HAND `arbitrate` AN INPUT THAT THROWS (see `.genesis/decisions/
 * 0008-demo.md` for the full argument): `arbitrate` throws on exactly two conditions --
 * `tally.deltaId !== delta.id`, and an inconsistent `gateResult`/`invariantRegistry` pair. This
 * file never builds a `tally` or a `gateResult` by hand at all -- it calls `evaluateDelta`
 * (`scenario.ts`, FROZEN), which always tallies with `delta.id` itself and always gates against
 * this domain's one `SUPPORT_TRIAGE_REGISTRY` -- so the pair `arbitrate` receives is consistent
 * BY CONSTRUCTION, not by a runtime check this file adds on top. The three `BehaviorDelta`
 * values below are fixed module-level constants with distinct, hardcoded ids; nothing in
 * `AdaptiveAgentDemo.tsx` lets a person type or choose a delta id, so no injected input can ever
 * reach `evaluateDelta` paired with the wrong delta's episodes.
 */

/** The three knobs this demo exposes a panel for — the full `DomainKnobId` vocabulary (two adaptable, one invariant-protected), reused directly rather than re-declared so this file cannot silently drift from `invariants.ts`'s own union. */
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
 * is (bypassing `proposeDelta` entirely, proving the freeze holds no matter how the delta was
 * constructed). Distinct ids from `scenario.ts`'s own fixtures, deliberately — this demo's state
 * is independent of the `npm run demo:triage` script's fixture data, never sharing an id with it.
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
 * position in this knob's full injection order) — never `Date.now()` — so this function, and
 * everything built on it, stays pure: the same sequence of inputs always produces the exact same
 * `Episode[]`, which is what makes `computeKnobView` a pure function safe to call fresh on every
 * render. `lib/evidence/tally.ts` never reads `observedAt` for anything but display (plan §4,
 * failure case 7), so this synthetic value never changes which `AdaptationDecision` results.
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

/** One knob panel's full, derived view — every field here is either an input echo or a real engine return value. */
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
 * whatever `inputs` the component's own state currently holds — no incremental/cached phase
 * tracked anywhere else, so there is no derived state that can go stale relative to `inputs`.
 *
 * Throws only if `evaluateDelta`/`arbitrate` themselves throw — which, per this file's own
 * header, cannot happen here because `delta` is always one of the three fixed `DEMO_DELTAS` and
 * every episode built from it below carries that same `delta.id`.
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
    // project's own "fail closed, don't paper over" standard; `AdaptiveAgentDemo.tsx` never
    // catches this because it is not reachable from any input the rendered form can submit.
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
    if (raw === undefined) continue; // noUncheckedIndexedAccess — inputs.length already bounds sequence, this never actually fires.
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
