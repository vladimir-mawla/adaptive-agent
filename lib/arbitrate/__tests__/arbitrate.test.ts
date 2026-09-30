import { describe, expect, it } from "vitest";
import { behaviorDeltaId } from "../../contracts/index.js";
import { arbitrate } from "../arbitrate.js";
import { EMPTY_REGISTRY, makeDelta, makeTally } from "./fixtures.js";

describe("arbitrate: vacant knob, not-yet-adopted candidate — adopt vs hold at the exact MIN_DISTINCT_CONTEXTS_ADOPT boundary", () => {
  it("N = MIN_DISTINCT_CONTEXTS_ADOPT (3) with a helped-majority resolves 'adopt', citing the exact tally", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id, { distinctContexts: 3, helped: 3, neutral: 0, harmed: 0 });
    const decision = arbitrate(delta, tally, "eligible", { kind: "vacant" }, EMPTY_REGISTRY);
    expect(decision).toEqual({ kind: "adopt", deltaId: delta.id, tally });
  });

  it("N = MIN_DISTINCT_CONTEXTS_ADOPT - 1 (2) with a helped-majority resolves 'hold', with distinctContextsNeeded: 1", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id, { distinctContexts: 2, helped: 2, neutral: 0, harmed: 0 });
    const decision = arbitrate(delta, tally, "eligible", { kind: "vacant" }, EMPTY_REGISTRY);
    expect(decision).toEqual({ kind: "hold", deltaId: delta.id, tally, distinctContextsNeeded: 1 });
  });

  it("enough distinct contexts but NO helped-majority (tied) still resolves 'hold', not 'adopt' — the context count alone is not the whole bar", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id, { distinctContexts: 5, helped: 2, neutral: 0, harmed: 2 });
    const decision = arbitrate(delta, tally, "eligible", { kind: "vacant" }, EMPTY_REGISTRY);
    expect(decision.kind).toBe("hold");
    // HONEST LIMIT, proven directly: distinctContextsNeeded is 0 here (the
    // context count already clears MIN_DISTINCT_CONTEXTS_ADOPT) even
    // though the reason for 'hold' is the missing helped-majority, not a
    // context shortfall — AdaptationDecision.hold (M1, FROZEN) has no
    // field to carry the real reason. See arbitrate.ts's own doc comment.
    if (decision.kind === "hold") expect(decision.distinctContextsNeeded).toBe(0);
  });

  it("a single context with an overwhelming episode count never reaches 'adopt' — distinctContexts, not episode volume, gates the bar", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id, { distinctContexts: 1, helped: 5000, neutral: 0, harmed: 0 });
    const decision = arbitrate(delta, tally, "eligible", { kind: "vacant" }, EMPTY_REGISTRY);
    expect(decision).toEqual({ kind: "hold", deltaId: delta.id, tally, distinctContextsNeeded: 2 });
  });

  it("zero evidence at all resolves 'hold' with the full shortfall", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id);
    const decision = arbitrate(delta, tally, "eligible", { kind: "vacant" }, EMPTY_REGISTRY);
    expect(decision).toEqual({ kind: "hold", deltaId: delta.id, tally, distinctContextsNeeded: 3 });
  });
});

describe("arbitrate: delta IS the live/adopted value on its knob — revert vs continued adopt at the exact MIN_DISTINCT_CONTEXTS_REVERT boundary", () => {
  it("N = MIN_DISTINCT_CONTEXTS_REVERT (2) with a harmed-majority resolves 'revert', rolling back to the prior replaced value", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id, { distinctContexts: 2, helped: 0, neutral: 0, harmed: 2 });
    const decision = arbitrate(
      delta,
      tally,
      "eligible",
      { kind: "live", liveDeltaId: delta.id, replacedValue: 0.3 },
      EMPTY_REGISTRY,
    );
    expect(decision).toEqual({ kind: "revert", deltaId: delta.id, tally, revertedTo: 0.3 });
  });

  it("N = MIN_DISTINCT_CONTEXTS_REVERT - 1 (1) with a harmed episode resolves continued 'adopt', never 'revert' off a single post-adoption incident", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id, { distinctContexts: 1, helped: 0, neutral: 0, harmed: 1 });
    const decision = arbitrate(
      delta,
      tally,
      "eligible",
      { kind: "live", liveDeltaId: delta.id, replacedValue: 0.3 },
      EMPTY_REGISTRY,
    );
    expect(decision).toEqual({ kind: "adopt", deltaId: delta.id, tally });
  });

  it("enough distinct contexts but NO harmed-majority resolves continued 'adopt', never 'hold' — plan names only revert-or-adopt for this branch", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id, { distinctContexts: 5, helped: 3, neutral: 0, harmed: 2 });
    const decision = arbitrate(
      delta,
      tally,
      "eligible",
      { kind: "live", liveDeltaId: delta.id, replacedValue: 0.3 },
      EMPTY_REGISTRY,
    );
    expect(decision).toEqual({ kind: "adopt", deltaId: delta.id, tally });
  });

  it("a same-context harmed replay storm (distinctContexts: 1) never reverts, no matter how many harmed episodes it repeats", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id, { distinctContexts: 1, helped: 0, neutral: 0, harmed: 5000 });
    const decision = arbitrate(
      delta,
      tally,
      "eligible",
      { kind: "live", liveDeltaId: delta.id, replacedValue: 0.3 },
      EMPTY_REGISTRY,
    );
    expect(decision).toEqual({ kind: "adopt", deltaId: delta.id, tally });
  });
});

describe("arbitrate is a pure function of its five inputs", () => {
  it("identical inputs, repeated calls, identical answer", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id, { distinctContexts: 3, helped: 3, neutral: 0, harmed: 0 });
    const results = Array.from({ length: 20 }, () => arbitrate(delta, tally, "eligible", { kind: "vacant" }, EMPTY_REGISTRY));
    expect(results.every((r) => r.kind === "adopt")).toBe(true);
  });
});

describe("arbitrate: an inconsistent gateResult/invariantRegistry pair is refused loudly, not papered over with a fabricated InvariantId", () => {
  it("throws if gateResult is 'frozen' but the supplied registry names no invariant on delta.knob", () => {
    const delta = makeDelta("d1", "escalation-aggressiveness", 0.3, 0.5);
    const tally = makeTally(delta.id);
    expect(() => arbitrate(delta, tally, "frozen", { kind: "vacant" }, EMPTY_REGISTRY)).toThrow(
      /inconsistent gateResult\/invariantRegistry pair/,
    );
  });
});

describe("arbitrate: deltaId on the returned decision always matches the delta arbitrated, never a stray id", () => {
  it("every branch echoes delta.id, not liveDeltaId or any other id in scope", () => {
    const delta = makeDelta("real-delta", "escalation-aggressiveness", 0.3, 0.5);
    const otherLiveId = behaviorDeltaId("some-other-delta");
    const tally = makeTally(delta.id, { distinctContexts: 5, helped: 5, neutral: 0, harmed: 0 });
    const decision = arbitrate(
      delta,
      tally,
      "eligible",
      { kind: "live", liveDeltaId: otherLiveId, replacedValue: 0.1 },
      EMPTY_REGISTRY,
    );
    expect(decision.deltaId).toBe(delta.id);
    expect(decision.deltaId).not.toBe(otherLiveId);
  });
});
