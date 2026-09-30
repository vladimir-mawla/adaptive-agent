import { describe, expect, it } from "vitest";
import { arbitrate } from "../arbitrate.js";
import { EMPTY_REGISTRY, makeDelta, makeTally } from "./fixtures.js";

/**
 * "AT MOST ONE LIVE DELTA PER KNOB" — plan §3 M5's own falsifiable check:
 * "a test asserting a second delta targeting an already-adopted knob
 * returns `hold`, never a silent second `adopt`." Proven here with a
 * rival candidate whose OWN tally would, on its own, clear the adopt bar
 * outright — so the only thing that can be stopping it is the contention
 * rule, not weak evidence.
 */
describe("at most one live delta per knob: a second candidate on an already-live knob is held, never silently adopted", () => {
  it("a second delta with OVERWHELMING evidence of its own still resolves 'hold' while a different delta already lives on the same knob", () => {
    const liveDelta = makeDelta("first", "escalation-aggressiveness", 0.3, 0.5);
    const rivalDelta = makeDelta("second", "escalation-aggressiveness", 0.5, 0.9);
    const rivalTally = makeTally(rivalDelta.id, { distinctContexts: 50, helped: 50, neutral: 0, harmed: 0 });

    const decision = arbitrate(
      rivalDelta,
      rivalTally,
      "eligible",
      { kind: "live", liveDeltaId: liveDelta.id, replacedValue: 0.3 },
      EMPTY_REGISTRY,
    );

    expect(decision.kind).toBe("hold");
    expect(decision.deltaId).toBe(rivalDelta.id);
  });

  it("the SAME rival, once the knob is vacant again (the first delta reverted/superseded), is free to adopt on its own merits", () => {
    const rivalDelta = makeDelta("second", "escalation-aggressiveness", 0.5, 0.9);
    const rivalTally = makeTally(rivalDelta.id, { distinctContexts: 50, helped: 50, neutral: 0, harmed: 0 });

    const decision = arbitrate(rivalDelta, rivalTally, "eligible", { kind: "vacant" }, EMPTY_REGISTRY);

    expect(decision.kind).toBe("adopt");
  });

  it("a rival targeting a DIFFERENT knob than the one currently live is unaffected by the contention rule", () => {
    const liveDelta = makeDelta("first", "escalation-aggressiveness", 0.3, 0.5);
    const independentDelta = makeDelta("independent", "response-directness", 0.1, 0.2);
    const independentTally = makeTally(independentDelta.id, { distinctContexts: 3, helped: 3, neutral: 0, harmed: 0 });

    // priorState is scoped to `independentDelta`'s OWN knob by the caller —
    // its knob has no rival, so it is passed "vacant" here, matching the
    // documented contract that priorState describes THIS delta's knob, not
    // a global map of every knob in the system.
    const decision = arbitrate(independentDelta, independentTally, "eligible", { kind: "vacant" }, EMPTY_REGISTRY);

    expect(decision.kind).toBe("adopt");
    void liveDelta; // referenced only to make the "a different delta lives elsewhere" premise explicit in the test's own narrative
  });
});
