import assert from "node:assert/strict";
import type { AdaptationDecision } from "../lib/contracts/adaptation-decision.js";
import { assertNeverAdaptationDecision } from "../lib/contracts/adaptation-decision.js";
import type { Episode } from "../lib/contracts/episode.js";
import type { KnobPriorState } from "../lib/arbitrate/arbitrate.js";
import {
  DIRECTNESS_CASE_VARIANT_EPISODES,
  DIRECTNESS_DELTA,
  ESCALATION_DELTA,
  ESCALATION_MONITORING_EPISODES,
  ESCALATION_TRIAL_EPISODES,
  REFUND_CEILING_DELTA,
  REFUND_CEILING_OVERWHELMING_EPISODES,
  evaluateDelta,
} from "../domains/support-triage/scenario.js";
import { AUTO_REFUND_CEILING_INVARIANT } from "../domains/support-triage/invariants.js";

/**
 * `scripts/demo-triage.ts` — `.genesis/PLAN.md`'s own M6 falsifiability check, verbatim:
 * "a scripted run showing an `escalation-aggressiveness` delta accumulate `hold` -> `hold` ->
 * `adopt` across three distinct tickets, then accumulate two distinct `harmed` post-adoption
 * episodes and flip to `revert`; and, in the same run, a delta proposal against
 * `auto-refund-ceiling` immediately ruled `frozen` regardless of how many synthetic
 * corroborating episodes are attached to it. Exits non-zero unless all four
 * `AdaptationDecision` kinds are actually observed in the run."
 *
 * EVERY VALUE PRINTED BELOW IS READ OFF A REAL RETURN VALUE FROM THE REAL ENGINE
 * (`evaluateDelta`, this domain's own thin composition of the frozen `tally` -> `gate` ->
 * `arbitrate` chain), never a hardcoded string asserted independently of the call whose result
 * it claims to describe. `assertDecision` below throws (non-zero exit) the moment a step's real
 * decision disagrees with what this script's own narration is about to print — the identical
 * discipline `~/Desktop/agent-control-tower/scripts/demo-incident.ts`'s own `assertRuling`
 * already uses, copied in SHAPE only (this project's own engine, contracts, and scenario are
 * unrelated to that one's).
 *
 * See this milestone's own build report for the sabotage experiment that proves this: a
 * scratch, reverted one-line change to `lib/arbitrate/arbitrate.ts`'s `clearsAdoptBar` made
 * this script throw an `AssertionError` and exit non-zero, rather than silently printing the
 * same success story with a now-false engine underneath it.
 */

let stepNumber = 0;
function step(title: string): void {
  stepNumber += 1;
  console.log(`\n--- Step ${stepNumber}: ${title} ---`);
}

function describeDecision(decision: AdaptationDecision<number>): string {
  switch (decision.kind) {
    case "adopt":
      return `ADOPT (tally: ${decision.tally.distinctContexts} distinct contexts, helped=${decision.tally.helped} neutral=${decision.tally.neutral} harmed=${decision.tally.harmed})`;
    case "hold":
      return `HOLD (needs ${decision.distinctContextsNeeded} more distinct context(s); tally: ${decision.tally.distinctContexts} distinct, helped=${decision.tally.helped} neutral=${decision.tally.neutral} harmed=${decision.tally.harmed})`;
    case "revert":
      return `REVERT to ${decision.revertedTo} (tally: ${decision.tally.distinctContexts} distinct contexts, helped=${decision.tally.helped} neutral=${decision.tally.neutral} harmed=${decision.tally.harmed})`;
    case "frozen":
      return `FROZEN (invariant: ${String(decision.invariant)})`;
    default:
      return assertNeverAdaptationDecision(decision);
  }
}

const observedKinds = new Set<AdaptationDecision<number>["kind"]>();
function trackKind(decision: AdaptationDecision<number>): void {
  observedKinds.add(decision.kind);
}

function assertDecision(
  decision: AdaptationDecision<number>,
  expectedKind: AdaptationDecision<number>["kind"],
  label: string,
): AdaptationDecision<number> {
  assert.equal(decision.kind, expectedKind, `${label}: expected decision.kind "${expectedKind}", got "${decision.kind}"`);
  return decision;
}

function mustEvaluate(
  delta: Parameters<typeof evaluateDelta>[0],
  episodes: readonly Episode[],
  priorState: KnobPriorState<number>,
  label: string,
): AdaptationDecision<number> {
  const result = evaluateDelta(delta, episodes, priorState);
  assert.equal(result.ok, true, `${label}: evaluateDelta refused the episode set (${!result.ok ? result.reason : ""})`);
  if (!result.ok) throw new Error("unreachable");
  return result.decision;
}

const VACANT: KnobPriorState<number> = { kind: "vacant" };

async function main(): Promise<void> {
  console.log("Adaptive Agent -- M6 domain demo: a support-triage agent adapting escalation aggressiveness and response directness, frozen on the refund ceiling");

  // ============================================================
  // Escalation-aggressiveness: hold -> hold -> adopt, across three genuinely distinct tickets.
  // ============================================================
  step(`escalation-aggressiveness delta proposed (from ${ESCALATION_DELTA.from} to ${ESCALATION_DELTA.to}), zero episodes yet`);
  const zeroEpisodes: readonly Episode[] = [];
  const decision0 = mustEvaluate(ESCALATION_DELTA, zeroEpisodes, VACANT, "escalation/0-episodes");
  console.log(`  ${describeDecision(decision0)}`);
  assertDecision(decision0, "hold", "escalation/0-episodes");
  trackKind(decision0);

  const trial = [...ESCALATION_TRIAL_EPISODES];
  step(`ticket 1 of 3 resolved without appeal (context ${String(trial[0]?.contextId)})`);
  const decision1 = mustEvaluate(ESCALATION_DELTA, trial.slice(0, 1), VACANT, "escalation/1-ticket");
  console.log(`  ${describeDecision(decision1)}`);
  assertDecision(decision1, "hold", "escalation/1-ticket");
  trackKind(decision1);

  step(`ticket 2 of 3 resolved without appeal (context ${String(trial[1]?.contextId)})`);
  const decision2 = mustEvaluate(ESCALATION_DELTA, trial.slice(0, 2), VACANT, "escalation/2-tickets");
  console.log(`  ${describeDecision(decision2)}`);
  assertDecision(decision2, "hold", "escalation/2-tickets");
  trackKind(decision2);

  step(`ticket 3 of 3 resolved without appeal (context ${String(trial[2]?.contextId)}) -- three genuinely distinct tickets now corroborate`);
  const decision3 = mustEvaluate(ESCALATION_DELTA, trial.slice(0, 3), VACANT, "escalation/3-tickets");
  console.log(`  ${describeDecision(decision3)}`);
  assertDecision(decision3, "adopt", "escalation/3-tickets");
  trackKind(decision3);
  console.log("  -> escalation-aggressiveness is now LIVE at 0.8. Post-adoption monitoring begins with a fresh episode pool (see .genesis/decisions/0006-domain.md, Decision on phase-scoped evidence pools).");

  // ============================================================
  // Post-adoption monitoring: one harmed episode is not enough; a second, distinct one flips it.
  // ============================================================
  const LIVE: KnobPriorState<number> = { kind: "live", liveDeltaId: ESCALATION_DELTA.id, replacedValue: ESCALATION_DELTA.from };
  const monitoring = [...ESCALATION_MONITORING_EPISODES];

  step(`post-adoption: one harmed ticket appealed and overturned (context ${String(monitoring[0]?.contextId)}) -- below the revert bar`);
  const decision4 = mustEvaluate(ESCALATION_DELTA, monitoring.slice(0, 1), LIVE, "escalation/1-harmed");
  console.log(`  ${describeDecision(decision4)}`);
  assertDecision(decision4, "adopt", "escalation/1-harmed");
  console.log("  -> a single post-adoption harmed episode must not, alone, trigger a revert -- the revert bar is lower than the adopt bar, but it is not zero.");
  trackKind(decision4);

  step(`post-adoption: a SECOND, distinct harmed ticket appealed and overturned (context ${String(monitoring[1]?.contextId)}) -- the revert bar clears`);
  const decision5 = mustEvaluate(ESCALATION_DELTA, monitoring.slice(0, 2), LIVE, "escalation/2-harmed");
  console.log(`  ${describeDecision(decision5)}`);
  assertDecision(decision5, "revert", "escalation/2-harmed");
  assert.equal((decision5 as { revertedTo: number }).revertedTo, ESCALATION_DELTA.from, "revert must roll back to the immediately-prior live value");
  trackKind(decision5);

  // ============================================================
  // Response-directness: the disclosed contextId-identity limit, exercised honestly.
  // ============================================================
  step("response-directness delta proposed, then evaluated against THREE episodes that are all, in reality, the SAME ticket (tck-9001), written three ways");
  for (const e of DIRECTNESS_CASE_VARIANT_EPISODES) {
    console.log(`    episode contextId = ${JSON.stringify(String(e.contextId))}`);
  }
  const decision6 = mustEvaluate(DIRECTNESS_DELTA, DIRECTNESS_CASE_VARIANT_EPISODES, VACANT, "directness/case-variants");
  console.log(`  ${describeDecision(decision6)}`);
  assertDecision(decision6, "adopt", "directness/case-variants");
  console.log(
    '  -> HONEST DISCLOSURE, NOT A BUG: this is the inherited limit M3 disclosed and M7 is expected to pin -- a contextId differing only by case or whitespace counts as a DISTINCT context. One real ticket, written three ways, clears the same 3-distinct-context bar a genuine three-ticket corroboration would. This codebase deliberately builds no normalization (the parsing-machinery mistake this series has already paid for twice) -- this scenario\'s OTHER path (escalation-aggressiveness, above) uses canonical, single-spelling ticket ids specifically so that path is not accidentally relying on this same gap.',
  );
  trackKind(decision6);

  // ============================================================
  // auto-refund-ceiling: frozen, regardless of overwhelming evidence.
  // ============================================================
  step(`auto-refund-ceiling delta proposed (from ${REFUND_CEILING_DELTA.from} to ${REFUND_CEILING_DELTA.to}), zero episodes yet`);
  const decision7 = mustEvaluate(REFUND_CEILING_DELTA, zeroEpisodes, VACANT, "refund-ceiling/0-episodes");
  console.log(`  ${describeDecision(decision7)}`);
  assertDecision(decision7, "frozen", "refund-ceiling/0-episodes");
  assert.equal((decision7 as { invariant: string }).invariant, AUTO_REFUND_CEILING_INVARIANT.id, "the frozen decision must cite this domain's own auto-refund-ceiling invariant");
  trackKind(decision7);

  step(`auto-refund-ceiling, RE-RUN with ${REFUND_CEILING_OVERWHELMING_EPISODES.length} distinct-context, all-"helped" episodes attached -- a pattern that would resolve ADOPT for either adaptable knob`);
  const decision8 = mustEvaluate(REFUND_CEILING_DELTA, REFUND_CEILING_OVERWHELMING_EPISODES, VACANT, "refund-ceiling/overwhelming-evidence");
  console.log(`  ${describeDecision(decision8)}`);
  assertDecision(decision8, "frozen", "refund-ceiling/overwhelming-evidence");
  assert.deepEqual(decision8, decision7, "the frozen decision must be identical with or without the overwhelming evidence attached -- evidence quantity never reaches this ruling at all");
  console.log("  -> identical ruling, evidence or none: no amount of corroborated \"helped\" evidence moves a decision off the one invariant-protected knob. Contrast with escalation-aggressiveness above, which needed exactly this shape of evidence (3 distinct contexts, helped-majority) to ADOPT.");
  trackKind(decision8);

  console.log("\n=== Summary ===");
  console.log(`AdaptationDecision kinds observed: ${[...observedKinds].sort().join(", ")}`);
  const expectedKinds: readonly AdaptationDecision<number>["kind"][] = ["adopt", "frozen", "hold", "revert"];
  for (const kind of expectedKinds) {
    assert.ok(observedKinds.has(kind), `expected the demo run to produce an AdaptationDecision of kind "${kind}" at least once`);
  }
  console.log("All four AdaptationDecision kinds (adopt, hold, revert, frozen) were observed at least once. Demo complete.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
