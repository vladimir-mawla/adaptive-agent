import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { distinctContextEpisodes, VACANT } from "./helpers.js";

/**
 * ============================================================
 * CASE 17 — THERE IS NO VALUE-RANGE CHECK AT ALL, NOT EVEN ON THE FIRST
 * PROPOSED DELTA (found independently by L4 VERIFY against the real
 * pipeline during this milestone's own review; not named anywhere in
 * `.genesis/PLAN.md` §4's own sketch)
 * ============================================================
 * KIND: DISCLOSES A REAL, UNSOLVED GAP — THE ROOT CAUSE CASE 9 IS ONE
 * MANIFESTATION OF, NOT A SEPARATE, LESSER ONE.
 *
 * WHY THIS IS ITS OWN CASE, NOT MERELY A RESTATEMENT OF CASE 9: case 9
 * (cumulative drift) demonstrates a knob walking far from baseline ACROSS
 * A SEQUENCE of several individually-corroborated adoptions. Read on its
 * own, that framing could leave a reader believing the risk requires an
 * attacker's patience — several rounds of ordinary-looking small steps,
 * accumulated over time. IT DOES NOT. This case demonstrates the deeper,
 * simpler root cause directly: a SINGLE delta, on its FIRST and ONLY
 * proposal, with perfectly ordinary, genuine 3-distinct-context
 * corroboration (no storm, no cast, no hostile input, no hand-built
 * bypass of `knobs.ts` — an entirely ordinary `proposeDelta` call),
 * proposing `escalation-aggressiveness` go from 0.5 to 999,999, adopts
 * immediately, first try. There is no range check anywhere in
 * `lib/contracts`, `lib/evidence`, `lib/invariants`, or `lib/arbitrate`
 * (all FROZEN) on `BehaviorDelta.to`/`from` at all — `KnobValue` is
 * generic (`unknown` by default, `number` in this domain per
 * `domains/support-triage/knobs.ts`'s own header), and nothing anywhere
 * in this system's frozen vocabulary or engine constrains a knob's value
 * to any range, documented or otherwise.
 *
 * WHY THIS IS NOT THIS MILESTONE'S TO FIX: the same reason case 9 is not
 * — `domains/support-triage/knobs.ts`'s own header documents
 * `escalation-aggressiveness` as "a bounded float in [0, 1]" in PROSE
 * only; no runtime check anywhere enforces it, and no plan bullet asks
 * for one (`.genesis/decisions/0006-domain.md` Decision 4 states plainly:
 * "No runtime bound-checking... is built for either knob — this
 * milestone's scope is the closed KNOB-NAME vocabulary and the decision
 * pipeline, not a validated value range").
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED):
 * `BehaviorDelta`/`proposeDelta`/`arbitrate` gaining a real value-range
 * check against each knob's own documented bounds — at which point this
 * single-step proposal would need to resolve something other than a bare
 * `adopt` (a typed rejection, a `hold`, or a thrown error) despite
 * otherwise-genuine 3-distinct-context corroboration.
 */
describe("CASE 17 (DISCLOSES, root cause of case 9): a single delta with an absurd, out-of-documented-range value adopts immediately, no sequence or drift required", () => {
  it("escalation-aggressiveness (documented [0, 1]) proposed from 0.5 to 999,999, with 3 genuine distinct helped contexts, adopts on its FIRST and ONLY proposal — no prior adoption, no history, no patience", () => {
    const delta = proposeDelta({
      id: "failure-case-17-delta",
      knob: "escalation-aggressiveness",
      from: 0.5,
      to: 999_999,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const result = evaluateDelta(delta, distinctContextEpisodes(delta.id, "tck-17", "helped", 3), VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
    expect(delta.to).toBe(999_999);
  });

  it("CONTROL, isolating the value itself as the only variable: the identical delta SHAPE with an in-range 'to' (0.8) also adopts — confirming this is not about the corroboration shape being somehow different for large values, only about the value never being checked at all", () => {
    const inRangeDelta = proposeDelta({
      id: "failure-case-17-control",
      knob: "escalation-aggressiveness",
      from: 0.5,
      to: 0.8,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const result = evaluateDelta(inRangeDelta, distinctContextEpisodes(inRangeDelta.id, "tck-17-control", "helped", 3), VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
  });

  it("the OTHER adaptable knob (response-directness, also documented [0, 1]) shows the identical gap — this is not specific to one knob's own code path", () => {
    const delta = proposeDelta({
      id: "failure-case-17-other-knob",
      knob: "response-directness",
      from: 0.4,
      to: -500,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const result = evaluateDelta(delta, distinctContextEpisodes(delta.id, "tck-17-negative", "helped", 3), VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
  });
});
