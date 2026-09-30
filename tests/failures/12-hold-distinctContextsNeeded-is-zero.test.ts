import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { distinctContextEpisodes, liveState } from "./helpers.js";

/**
 * ============================================================
 * CASE 12 — `hold.distinctContextsNeeded` IS 0 WHEN THE BLOCKER IS A
 * FAILED MAJORITY OR KNOB CONTENTION, NOT A CONTEXT SHORTFALL (named
 * explicitly in this milestone's own brief; recorded in
 * `.genesis/decisions/0005-arbitration.md` Decision 5)
 * ============================================================
 * KIND: DISCLOSES A REAL, UNSOLVED GAP.
 *
 * THE GAP, STATED PLAINLY: `AdaptationDecision.hold` (M1, FROZEN) carries
 * exactly one number, `distinctContextsNeeded` — no field for WHY a hold
 * fired beyond "how many more distinct contexts would flip this to
 * adopt." `arbitrate` produces `hold` for three structurally different
 * reasons (0005-arbitration.md Decision 5): (1) a genuine context
 * shortfall — the number means something; (2) enough contexts, no
 * helped-majority — the number is honestly 0, because no more CONTEXTS
 * are needed, but the real blocker (the majority) has no field to name;
 * (3) blocked by a rival live delta on the same knob — same zero, same
 * missing field for the real blocker. This case demonstrates BOTH
 * non-shortfall routes side by side, through the full pipeline, so a
 * reader sees the ambiguity concretely rather than trusting the ADR's own
 * prose — case 4 already demonstrates route (3) alone; this file adds
 * route (2) and puts both next to each other.
 *
 * WHY THIS IS NOT THIS MILESTONE'S TO FIX: plan §3 promises a rejected
 * candidate is held "with a stated reason," but `lib/contracts/**` (M1)
 * is FROZEN and has no field to carry that reason on the returned value
 * itself — 0005-arbitration.md records this as a genuine plan
 * requirement a frozen contract shape cannot satisfy, not a bug this
 * milestone introduced.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED): a
 * revised `AdaptationDecision.hold` (a contracts change out of this
 * milestone's authority) gaining a `reason` field distinguishing these
 * three cases — at which point `distinctContextsNeeded: 0` would no
 * longer be the only signal available for two structurally different
 * blockers.
 */
describe("CASE 12 (DISCLOSES): hold.distinctContextsNeeded === 0 collapses two different real blockers into one indistinguishable number", () => {
  it("ROUTE 1 (for comparison, a genuine shortfall): 1 distinct context needs 2 more — the number is honest and actionable here", () => {
    const delta = proposeDelta({
      id: "failure-case-12-shortfall",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.9,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const result = evaluateDelta(delta, distinctContextEpisodes(delta.id, "tck-shortfall", "helped", 1), { kind: "vacant" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    expect(result.decision.kind === "hold" && result.decision.distinctContextsNeeded).toBe(2);
  });

  it("ROUTE 2, THE GAP (majority-blocked): 5 distinct contexts (well past the shortfall bar) but no helped-majority reports distinctContextsNeeded: 0 — indistinguishable, by this field alone, from 'no problem at all'", () => {
    const delta = proposeDelta({
      id: "failure-case-12-majority",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.9,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const fiveContextsTiedOutcome = [
      ...distinctContextEpisodes(delta.id, "tck-majority-helped", "helped", 2),
      ...distinctContextEpisodes(delta.id, "tck-majority-harmed", "harmed", 3),
    ];
    const result = evaluateDelta(delta, fiveContextsTiedOutcome, { kind: "vacant" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    expect(result.decision.kind === "hold" && result.decision.tally.distinctContexts).toBe(5);
    // THE GAP: distinctContextsNeeded reads 0, identical to what route 3
    // (contention) below also reports — despite the real blocker here
    // being "no helped-majority," not "not enough distinct contexts."
    expect(result.decision.kind === "hold" && result.decision.distinctContextsNeeded).toBe(0);
  });

  it("ROUTE 3, THE GAP (contention-blocked): a rival delta with strong evidence is held with the SAME distinctContextsNeeded: 0 — the two 'reasons' are structurally indistinguishable from this field alone", () => {
    const liveDelta = proposeDelta({
      id: "failure-case-12-live",
      knob: "response-directness",
      from: 0.3,
      to: 0.5,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const rival = proposeDelta({
      id: "failure-case-12-rival",
      knob: "response-directness",
      from: 0.3,
      to: 0.9,
      proposedAt: "2026-03-05T00:00:00Z",
    });
    const result = evaluateDelta(
      rival,
      distinctContextEpisodes(rival.id, "tck-contention", "helped", 10),
      liveState(liveDelta.id, 0.3),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    // Identical distinctContextsNeeded to route 2 above (0), for a
    // completely different real reason (occupancy, not majority) — a
    // caller reading only this field cannot tell routes 2 and 3 apart,
    // nor tell either apart from "everything is actually fine."
    expect(result.decision.kind === "hold" && result.decision.distinctContextsNeeded).toBe(0);
  });
});
