import type { BehaviorDelta } from "../../lib/contracts/behavior-delta.js";
import { behaviorDeltaId, contextId } from "../../lib/contracts/ids.js";
import { timestamp } from "../../lib/contracts/timestamp.js";
import type { Episode, EpisodeOutcome } from "../../lib/contracts/episode.js";
import type { AdaptationDecision } from "../../lib/contracts/adaptation-decision.js";
import { tally } from "../../lib/evidence/tally.js";
import { gate } from "../../lib/invariants/gate.js";
import { arbitrate, type KnobPriorState } from "../../lib/arbitrate/arbitrate.js";
import { proposeDelta } from "./knobs.js";
import { SUPPORT_TRIAGE_REGISTRY, type DomainKnobId } from "./invariants.js";

/**
 * `domains/support-triage/scenario.ts` — the concrete fixture data plus the one piece of
 * domain-owned glue (`evaluateDelta`, below) that composes the three FROZEN engine layers
 * (`lib/evidence.tally` → `lib/invariants.gate` → `lib/arbitrate.arbitrate`) into one call a
 * demo or test can make per decision point. This file constructs no new engine logic — every
 * refusal a reader can observe here (a replay storm collapsing to one context, an invariant
 * beating overwhelming evidence, an asymmetric revert bar) is a FROZEN `lib/**` behavior being
 * exercised, not reimplemented.
 *
 * ============================================================
 * A DOMAIN DECISION THIS PLAN LEAVES OPEN, FOUND BY TRYING TO BUILD THE FALSIFIABLE CHECK
 * LITERALLY, NOT GUESSED AT IN ADVANCE — RECORDED IN FULL IN `.genesis/decisions/0006-domain.md`:
 * ============================================================
 *
 * `arbitrate` (M5, FROZEN) takes exactly one `tally: EvidenceTally` and one `priorState` per
 * call — it has no notion of "phase" at all, and no memory of a delta's own evidence history
 * across calls. Plan §3 (M6)'s own falsifiable check describes TWO episode pools for the SAME
 * delta: the pre-adoption trial ("three distinct tickets" that carry it to `adopt`) and the
 * post-adoption monitoring evidence ("two distinct harmed post-adoption episodes" that flip it
 * to `revert`). Nothing in `lib/arbitrate` or plan §3/§4 says whether the REVERT-PHASE tally
 * should be computed from just the post-adoption episodes, or cumulatively from every episode
 * the delta has ever accumulated (pre- and post-adoption combined).
 *
 * THIS MATTERS, CONCRETELY: this scenario's own pre-adoption trial is 3 `"helped"` episodes.
 * If the post-adoption tally were computed CUMULATIVELY (3 helped + 2 new harmed = 5 episodes,
 * `distinctContexts: 5`), `harmedMajority` (`harmed > helped + neutral`, i.e. `2 > 3`) is FALSE
 * — the scenario could never reach `revert` at all, no matter how many post-adoption `"harmed"`
 * episodes accumulated, as long as enough pre-adoption `"helped"` ones outnumbered them. Plan
 * §3 (M6) asserts a demo CAN reach `revert` off exactly two post-adoption harmed episodes, so a
 * cumulative pool is not merely one defensible reading — it is one that would make the plan's
 * own literal falsifiable check unsatisfiable by this scenario's own numbers as designed.
 *
 * THE DECISION THIS FILE MAKES: each phase gets its OWN fresh episode pool. `evaluateDelta`
 * is handed exactly the episodes relevant to the phase it is judging — pre-adoption trial
 * episodes while `priorState.kind === "vacant"`, post-adoption monitoring episodes once
 * `priorState.kind === "live"` names this same delta as the live value. This is a real, disclosed
 * domain-level choice this milestone made (not one `lib/arbitrate` enforces or even knows
 * about — that function trusts whatever `tally` it is handed) — a different, equally defensible
 * domain could choose a sliding window, a cumulative pool, or a decayed reweighting instead, and
 * `lib/arbitrate`'s own frozen signature would accept any of them without complaint. Recorded as
 * a finding, not silently resolved by picking the one number that makes this scenario's own
 * numbers work.
 */

function episode(deltaId: ReturnType<typeof behaviorDeltaId>, ctx: string, outcome: EpisodeOutcome, observedAt: string): Episode {
  return { deltaId, contextId: contextId(ctx), outcome, observedAt: timestamp(observedAt) };
}

/** The result of one `evaluateDelta` call — either a real `AdaptationDecision`, or a typed failure if `lib/evidence.tally` itself refused the input (never thrown past this function — see `lib/evidence/tally.ts`'s own "fails closed" discipline, inherited here rather than re-decided). */
export type DecisionResult =
  | { readonly ok: true; readonly decision: AdaptationDecision<number> }
  | { readonly ok: false; readonly reason: string };

/**
 * The one piece of glue this domain owns: tally the episodes relevant to the CALLER-CHOSEN
 * phase, gate the delta against this domain's one invariant, and arbitrate — in that order,
 * matching `lib/arbitrate`'s own documented call shape exactly (`gate` first to produce
 * `gateResult`, the SAME registry threaded into `arbitrate` as its fifth parameter).
 * `delta`/`registry` are both typed over `DomainKnobId` — the full three-member vocabulary —
 * so this one function can evaluate an ordinary `knobs.ts`-proposed delta AND a hand-built
 * delta targeting the protected knob, identically, through the identical code path (no branch
 * anywhere in this function inspects `delta.knob` before calling `gate` — the frozen knob is
 * never special-cased here; `lib/invariants.gate` is what tells this function the knob is
 * frozen, not a domain-level `if`).
 */
export function evaluateDelta(
  delta: BehaviorDelta<DomainKnobId, number>,
  episodesForThisPhase: readonly Episode[],
  priorState: KnobPriorState<number>,
): DecisionResult {
  const tallyResult = tally(delta.id, episodesForThisPhase);
  if (!tallyResult.ok) {
    return { ok: false, reason: `lib/evidence.tally refused this episode set: ${tallyResult.error.kind}` };
  }
  const gateResult = gate<DomainKnobId, number>(delta, SUPPORT_TRIAGE_REGISTRY);
  const decision = arbitrate<DomainKnobId, number>(delta, tallyResult.tally, gateResult, priorState, SUPPORT_TRIAGE_REGISTRY);
  return { ok: true, decision };
}

// ============================================================
// Scenario 1 — escalation-aggressiveness: hold -> hold -> adopt -> (adopt continues) -> revert.
// Contexts are genuinely distinct real tickets (different customers, different days) — this
// path is designed to FAIL if corroboration were ever satisfied by volume instead of diversity.
// ============================================================

export const ESCALATION_DELTA: BehaviorDelta<DomainKnobId, number> = proposeDelta({
  id: "delta-escalation-aggressiveness-1",
  knob: "escalation-aggressiveness",
  from: 0.5,
  to: 0.8,
  proposedAt: "2026-01-05T09:00:00Z",
});

/** Three genuinely distinct tickets, canonical lowercase ids, no whitespace/case/Unicode variation — deliberately NOT exercising the inherited contextId-identity limit here (see DIRECTNESS_CASE_VARIANT_EPISODES below for where this scenario deliberately DOES exercise it, honestly, rather than mixing the two concerns in one path). */
export const ESCALATION_TRIAL_EPISODES: readonly Episode[] = [
  episode(ESCALATION_DELTA.id, "tck-4471", "helped", "2026-01-06T10:00:00Z"),
  episode(ESCALATION_DELTA.id, "tck-5002", "helped", "2026-01-09T14:30:00Z"),
  episode(ESCALATION_DELTA.id, "tck-5108", "helped", "2026-01-14T08:15:00Z"),
];

/** Two distinct post-adoption tickets, both harmed — a different pair of real tickets than the trial pool, monitoring the now-live knob value. */
export const ESCALATION_MONITORING_EPISODES: readonly Episode[] = [
  episode(ESCALATION_DELTA.id, "tck-6210", "harmed", "2026-02-02T11:00:00Z"),
  episode(ESCALATION_DELTA.id, "tck-6355", "harmed", "2026-02-10T16:45:00Z"),
];

// ============================================================
// Scenario 2 — response-directness: the SAME real ticket, written three ways, exercising the
// inherited limit M3 disclosed and M7 is expected to pin (a contextId differing only by case,
// whitespace, or Unicode normalization counts as DISTINCT) HONESTLY, in the open, rather than
// silently relying on it or hiding it. This scenario is deliberately NOT built to look like
// Scenario 1 — a different knob, a different episode count, a one-shot evaluation rather than
// an incremental one — so a regression that only breaks one shape has nowhere to hide.
// ============================================================

export const DIRECTNESS_DELTA: BehaviorDelta<DomainKnobId, number> = proposeDelta({
  id: "delta-response-directness-1",
  knob: "response-directness",
  from: 0.4,
  to: 0.6,
  proposedAt: "2026-01-05T09:00:00Z",
});

/** One real ticket (`tck-9001`), written three ways: plain, upper-cased, and with leading/trailing whitespace. `lib/evidence.tally` dedups strictly by exact string equality on `contextId` (M3, FROZEN, disclosed non-goal — no normalization anywhere in this codebase, by this account's own standing instruction not to build parsing/normalization machinery). All three count as distinct contexts here, clearing `MIN_DISTINCT_CONTEXTS_ADOPT` even though a human reading the three raw strings would recognize one ticket, not three. */
export const DIRECTNESS_CASE_VARIANT_EPISODES: readonly Episode[] = [
  episode(DIRECTNESS_DELTA.id, "tck-9001", "helped", "2026-01-07T09:00:00Z"),
  episode(DIRECTNESS_DELTA.id, "TCK-9001", "helped", "2026-01-07T09:05:00Z"),
  episode(DIRECTNESS_DELTA.id, " tck-9001 ", "helped", "2026-01-07T09:10:00Z"),
];

// ============================================================
// Scenario 3 — auto-refund-ceiling: frozen regardless of evidence. This delta is built
// DIRECTLY as a `BehaviorDelta<DomainKnobId, number>` literal, bypassing `knobs.ts.proposeDelta`
// entirely (that function's own parameter type cannot name this knob at all — see
// `knobs.ts`'s header) — proving the freeze holds no matter how the delta was constructed or
// who "proposed" it, not merely that this domain's own one sanctioned entry point declines to
// build one (plan §4's failure case 10, exercised here at the domain layer, not only at M7's).
// ============================================================

export const REFUND_CEILING_DELTA: BehaviorDelta<DomainKnobId, number> = {
  id: behaviorDeltaId("delta-auto-refund-ceiling-attack-1"),
  knob: "auto-refund-ceiling",
  from: 500,
  to: 750,
  proposedAt: timestamp("2026-01-20T12:00:00Z"),
};

/** Five distinct-context, all-`"helped"` episodes — comfortably past `MIN_DISTINCT_CONTEXTS_ADOPT` (3) with a helped-majority, i.e. exactly the pattern that resolves `adopt` for either of this domain's two ADAPTABLE knobs. Attached to a delta targeting the one INVARIANT-protected knob instead, to make the contrast concrete rather than asserted in prose alone. */
export const REFUND_CEILING_OVERWHELMING_EPISODES: readonly Episode[] = [
  episode(REFUND_CEILING_DELTA.id, "tck-7001", "helped", "2026-01-21T09:00:00Z"),
  episode(REFUND_CEILING_DELTA.id, "tck-7002", "helped", "2026-01-21T10:00:00Z"),
  episode(REFUND_CEILING_DELTA.id, "tck-7003", "helped", "2026-01-22T09:00:00Z"),
  episode(REFUND_CEILING_DELTA.id, "tck-7004", "helped", "2026-01-23T09:00:00Z"),
  episode(REFUND_CEILING_DELTA.id, "tck-7005", "helped", "2026-01-24T09:00:00Z"),
];
