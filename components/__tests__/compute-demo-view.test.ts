import { describe, expect, it } from "vitest";
import { DEMO_DELTAS, DEMO_KNOB_IDS, computeKnobView, type RawEpisodeInput } from "../compute-demo-view.js";

/**
 * `components/__tests__/compute-demo-view.test.ts` — falsifiable tests for M8's one view-model
 * function. Every test drives `computeKnobView` exactly the way `AdaptiveAgentDemo.tsx` does:
 * an ordered array of `RawEpisodeInput` a person could actually type/select in the form, never
 * a hand-built `Episode`/`EvidenceTally`/`AdaptationDecision` asserted independently of a real
 * call. See this milestone's own report for the gutting experiment this suite was run against.
 */

function helped(id: string): RawEpisodeInput {
  return { contextId: id, outcome: "helped" };
}
function harmed(id: string): RawEpisodeInput {
  return { contextId: id, outcome: "harmed" };
}

describe("escalation-aggressiveness: hold -> hold -> adopt -> revert, the headline non-frozen story", () => {
  it("zero episodes -> TRIAL phase, hold, needs 3 more distinct contexts", () => {
    const view = computeKnobView("escalation-aggressiveness", []);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("hold");
    expect(view.decision.kind === "hold" && view.decision.distinctContextsNeeded).toBe(3);
  });

  it("2 distinct helped episodes -> still TRIAL, hold, needs 1 more", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1"), helped("tck-2")]);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("hold");
    expect(view.decision.kind === "hold" && view.decision.distinctContextsNeeded).toBe(1);
  });

  it("3 distinct helped episodes -> flips to LIVE, adopt", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1"), helped("tck-2"), helped("tck-3")]);
    expect(view.phase).toBe("live");
    expect(view.decision.kind).toBe("adopt");
    expect(view.trialEpisodes).toHaveLength(3);
    expect(view.monitoringEpisodes).toHaveLength(0);
  });

  it("one post-adoption harmed episode is NOT enough to revert (asymmetric bar, but not zero)", () => {
    const view = computeKnobView("escalation-aggressiveness", [
      helped("tck-1"),
      helped("tck-2"),
      helped("tck-3"),
      harmed("tck-4"),
    ]);
    expect(view.phase).toBe("live");
    expect(view.decision.kind).toBe("adopt");
    expect(view.monitoringEpisodes).toHaveLength(1);
  });

  it("a SECOND distinct post-adoption harmed episode flips it to revert, rolling back to delta.from", () => {
    const view = computeKnobView("escalation-aggressiveness", [
      helped("tck-1"),
      helped("tck-2"),
      helped("tck-3"),
      harmed("tck-4"),
      harmed("tck-5"),
    ]);
    expect(view.phase).toBe("live");
    expect(view.decision.kind).toBe("revert");
    expect(view.decision.kind === "revert" && view.decision.revertedTo).toBe(DEMO_DELTAS["escalation-aggressiveness"].from);
    expect(view.monitoringEpisodes).toHaveLength(2);
  });

  it("FALSIFIABILITY: a same-context replay storm never reaches adopt — 50 repeats of one ticket is still distinctContexts: 1", () => {
    const storm = Array.from({ length: 50 }, () => helped("tck-1"));
    const view = computeKnobView("escalation-aggressiveness", storm);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("hold");
    expect(view.decision.kind === "hold" && view.decision.distinctContextsNeeded).toBe(2);
  });

  it("every decision's own tally.deltaId matches this knob's delta id, by construction", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1")]);
    expect(view.decision.kind).toBe("hold");
    expect(view.decision.kind === "hold" && view.decision.tally.deltaId).toBe(view.delta.id);
  });
});

describe("response-directness: the contextId-identity limit, exercised honestly", () => {
  it("the same ticket typed three ways (case + whitespace) counts as three distinct contexts and clears adopt", () => {
    const view = computeKnobView("response-directness", [helped("tck-9001"), helped("TCK-9001"), helped(" tck-9001 ")]);
    expect(view.phase).toBe("live");
    expect(view.decision.kind).toBe("adopt");
    expect(view.decision.kind === "adopt" && view.decision.tally.distinctContexts).toBe(3);
  });

  it("the identical ticket typed the SAME way three times stays exactly one context and holds", () => {
    const view = computeKnobView("response-directness", [helped("tck-9001"), helped("tck-9001"), helped("tck-9001")]);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("hold");
    expect(view.decision.kind === "hold" && view.decision.tally.distinctContexts).toBe(1);
  });
});

describe("auto-refund-ceiling: frozen, unconditionally, regardless of evidence", () => {
  it("zero episodes -> frozen, citing this domain's invariant", () => {
    const view = computeKnobView("auto-refund-ceiling", []);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("frozen");
  });

  it("5 distinct-context, all-helped episodes (a pattern that would ADOPT either adaptable knob) still resolves frozen, identically", () => {
    const zero = computeKnobView("auto-refund-ceiling", []);
    const overwhelmed = computeKnobView("auto-refund-ceiling", [
      helped("tck-a"),
      helped("tck-b"),
      helped("tck-c"),
      helped("tck-d"),
      helped("tck-e"),
    ]);
    expect(overwhelmed.phase).toBe("trial");
    expect(overwhelmed.decision.kind).toBe("frozen");
    // Identical ruling, evidence or none — evidence quantity never reaches this decision at all.
    expect(overwhelmed.decision).toEqual(zero.decision);
  });

  it("10,000 synthetic helped episodes across 10,000 distinct contexts still resolves frozen", () => {
    const flood = Array.from({ length: 10_000 }, (_, i) => helped(`tck-flood-${i}`));
    const view = computeKnobView("auto-refund-ceiling", flood);
    expect(view.decision.kind).toBe("frozen");
  });

  it("never leaves the trial phase, no matter how much evidence piles up", () => {
    const view = computeKnobView("auto-refund-ceiling", Array.from({ length: 500 }, (_, i) => helped(`tck-${i}`)));
    expect(view.phase).toBe("trial");
  });
});

describe("purity and construction invariants", () => {
  it("computeKnobView is pure: the same input list produces a deep-equal view every time", () => {
    const inputs = [helped("tck-1"), helped("tck-2"), harmed("tck-3")];
    const first = computeKnobView("escalation-aggressiveness", inputs);
    const second = computeKnobView("escalation-aggressiveness", inputs);
    expect(second).toEqual(first);
  });

  it("each of the three demo knobs is backed by a distinct, hardcoded BehaviorDeltaId", () => {
    const ids = DEMO_KNOB_IDS.map((knobId) => DEMO_DELTAS[knobId].id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each demo delta's own knob field matches the key it's registered under", () => {
    for (const knobId of DEMO_KNOB_IDS) {
      expect(DEMO_DELTAS[knobId].knob).toBe(knobId);
    }
  });
});
