import { describe, expect, it } from "vitest";
import {
  DIRECTNESS_CASE_VARIANT_EPISODES,
  DIRECTNESS_DELTA,
  ESCALATION_DELTA,
  ESCALATION_MONITORING_EPISODES,
  ESCALATION_TRIAL_EPISODES,
  REFUND_CEILING_DELTA,
  REFUND_CEILING_OVERWHELMING_EPISODES,
  evaluateDelta,
} from "../scenario.js";
import type { KnobPriorState } from "../../../lib/arbitrate/arbitrate.js";
import { behaviorDeltaId } from "../../../lib/contracts/ids.js";

const VACANT: KnobPriorState<number> = { kind: "vacant" };

describe("escalation-aggressiveness: hold -> hold -> adopt across three distinct tickets", () => {
  it("zero episodes -> hold, needs 3 more", () => {
    const result = evaluateDelta(ESCALATION_DELTA, [], VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    expect(result.decision.kind === "hold" && result.decision.distinctContextsNeeded).toBe(3);
  });

  it("1 distinct ticket -> hold, needs 2 more", () => {
    const result = evaluateDelta(ESCALATION_DELTA, ESCALATION_TRIAL_EPISODES.slice(0, 1), VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    expect(result.decision.kind === "hold" && result.decision.distinctContextsNeeded).toBe(2);
  });

  it("2 distinct tickets -> hold, needs 1 more", () => {
    const result = evaluateDelta(ESCALATION_DELTA, ESCALATION_TRIAL_EPISODES.slice(0, 2), VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    expect(result.decision.kind === "hold" && result.decision.distinctContextsNeeded).toBe(1);
  });

  it("3 distinct tickets, all helped -> adopt", () => {
    const result = evaluateDelta(ESCALATION_DELTA, ESCALATION_TRIAL_EPISODES.slice(0, 3), VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
  });

  it("FALSIFIABILITY: a same-context replay storm never reaches adopt on its own — 50 repeats of ticket 1 is still distinctContexts: 1", () => {
    const [first] = ESCALATION_TRIAL_EPISODES;
    if (first === undefined) throw new Error("unreachable");
    const storm = Array.from({ length: 50 }, () => first);
    const result = evaluateDelta(ESCALATION_DELTA, storm, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    expect(result.decision.kind === "hold" && result.decision.distinctContextsNeeded).toBe(2);
  });
});

describe("escalation-aggressiveness post-adoption: revert needs two distinct harmed contexts, not one", () => {
  const LIVE: KnobPriorState<number> = { kind: "live", liveDeltaId: ESCALATION_DELTA.id, replacedValue: ESCALATION_DELTA.from };

  it("one post-adoption harmed episode -> adopt continues, not revert", () => {
    const result = evaluateDelta(ESCALATION_DELTA, ESCALATION_MONITORING_EPISODES.slice(0, 1), LIVE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
  });

  it("two distinct post-adoption harmed episodes -> revert, to the immediately-prior value", () => {
    const result = evaluateDelta(ESCALATION_DELTA, ESCALATION_MONITORING_EPISODES.slice(0, 2), LIVE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("revert");
    expect(result.decision.kind === "revert" && result.decision.revertedTo).toBe(ESCALATION_DELTA.from);
  });

  it("a different delta already live on this knob -> this delta is held regardless of its own tally", () => {
    const rivalLive: KnobPriorState<number> = {
      kind: "live",
      liveDeltaId: behaviorDeltaId("some-other-live-delta"),
      replacedValue: 0.1,
    };
    const result = evaluateDelta(ESCALATION_DELTA, ESCALATION_TRIAL_EPISODES, rivalLive);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("hold");
    // Pinned on the real tally values too, not just `kind` — a gutted evaluateDelta that always
    // returns a fixed hold/distinctContexts:0/distinctContextsNeeded:999 stub would otherwise
    // pass this test coincidentally (found by this milestone's own gutting experiment; see the
    // PR report). ESCALATION_TRIAL_EPISODES genuinely clears the distinct-context bar (3, all
    // helped) — it is the RIVAL knob occupancy holding this delta back, not a shortfall, so
    // distinctContextsNeeded must be honestly 0 here, never a stub's arbitrary placeholder.
    expect(result.decision.kind === "hold" && result.decision.tally.distinctContexts).toBe(3);
    expect(result.decision.kind === "hold" && result.decision.tally.helped).toBe(3);
    expect(result.decision.kind === "hold" && result.decision.distinctContextsNeeded).toBe(0);
  });
});

describe("response-directness: the disclosed contextId-identity limit, exercised (not hidden)", () => {
  it("three case/whitespace variants of ONE real ticket clear the same distinct-context bar a genuine three-ticket corroboration would", () => {
    const result = evaluateDelta(DIRECTNESS_DELTA, DIRECTNESS_CASE_VARIANT_EPISODES, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
    expect(result.decision.kind === "adopt" && result.decision.tally.distinctContexts).toBe(3);
  });
});

describe("auto-refund-ceiling: frozen regardless of evidence volume", () => {
  it("zero episodes -> frozen", () => {
    const result = evaluateDelta(REFUND_CEILING_DELTA, [], VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("frozen");
  });

  it("5 distinct-context, all-helped episodes (a pattern that clears the adopt bar for an adaptable knob) -> still frozen, identical decision", () => {
    const withoutEvidence = evaluateDelta(REFUND_CEILING_DELTA, [], VACANT);
    const withEvidence = evaluateDelta(REFUND_CEILING_DELTA, REFUND_CEILING_OVERWHELMING_EPISODES, VACANT);
    expect(withoutEvidence.ok).toBe(true);
    expect(withEvidence.ok).toBe(true);
    if (!withoutEvidence.ok || !withEvidence.ok) return;
    expect(withEvidence.decision.kind).toBe("frozen");
    expect(withEvidence.decision).toEqual(withoutEvidence.decision);
  });

  it("FALSIFIABILITY: the same 5-episode evidence shape genuinely would adopt on an adaptable knob — proving frozen is not just 'no evidence was attached'", () => {
    const result = evaluateDelta(ESCALATION_DELTA, REFUND_CEILING_OVERWHELMING_EPISODES.map((e) => ({ ...e, deltaId: ESCALATION_DELTA.id })), VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
  });
});
