import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Episode } from "../../lib/contracts/episode.js";
import type { EvidenceTally } from "../../lib/contracts/evidence-tally.js";
import { DEMO_DELTAS, computeKnobView, type RawEpisodeInput } from "../compute-demo-view.js";

/**
 * `components/__tests__/compute-demo-view.engine-spy.test.ts` — what the view-model actually
 * HANDS to the engine, observed at two real function boundaries rather than inferred from its
 * output.
 *
 * WHY THIS FILE EXISTS. A `frozen` decision carries no tally (`lib/contracts`: `tally?: never`), so
 * nothing in `computeKnobView`'s OUTPUT can show whether the protected knob's episodes were given to
 * the engine at all. L4 VERIFY's mutant that kept `trialEpisodes` in the view but called
 * `evaluateDelta(delta, [], ...)` for that knob passed every output-based test (380/380). ADR 0008
 * Decision 8's argument — the demo shows `frozen` being IMMUNE to evidence rather than a panel that
 * never saw any — rests on exactly that unobservable fact, so it is observed here directly.
 *
 * WHAT IS SPIED, AND NOTHING BEYOND IT. Two wrappers, each calling straight through to the real
 * implementation (the real functions still run; nothing is stubbed):
 *   1. `evaluateDelta` (`domains/support-triage/scenario.ts`) — records the delta id, the episode
 *      list it was called with (copied at call time, so later in-place pushes cannot alter the
 *      record) and the `priorState` kind.
 *   2. `arbitrate` (`lib/arbitrate/arbitrate.ts`) — records the `EvidenceTally` and `gateResult` it
 *      was called with, and the decision kind it returned. For the protected knob this is the point
 *      at which the evidence is demonstrably present AND demonstrably not what decides the ruling.
 * What is NOT spied: `tally` and `gate` are not wrapped, so the hand-off from `evaluateDelta` to them
 * is established only by `arbitrate` receiving a tally whose counts equal the episodes' — not
 * observed directly.
 */

const spy = vi.hoisted(() => ({
  evaluate: [] as Array<{ deltaId: string; length: number; priorKind: string }>,
  lastEpisodes: new Map<string, readonly Episode[]>(),
  arbitrate: [] as Array<{
    deltaId: string;
    tally: EvidenceTally;
    gateResult: string;
    priorKind: string;
    decisionKind: string;
  }>,
}));

vi.mock("../../domains/support-triage/scenario.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../domains/support-triage/scenario.js")>();
  return {
    ...actual,
    evaluateDelta: (...args: Parameters<typeof actual.evaluateDelta>) => {
      const [delta, episodes, priorState] = args;
      spy.evaluate.push({ deltaId: String(delta.id), length: episodes.length, priorKind: priorState.kind });
      spy.lastEpisodes.set(String(delta.id), episodes.slice());
      return actual.evaluateDelta(...args);
    },
  };
});

vi.mock("../../lib/arbitrate/arbitrate.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/arbitrate/arbitrate.js")>();
  return {
    ...actual,
    arbitrate: (...args: Parameters<typeof actual.arbitrate>) => {
      const [delta, tally, gateResult, priorState] = args;
      const decision = actual.arbitrate(...args);
      spy.arbitrate.push({
        deltaId: String(delta.id),
        tally,
        gateResult,
        priorKind: priorState.kind,
        decisionKind: decision.kind,
      });
      return decision;
    },
  };
});

function helped(id: string): RawEpisodeInput {
  return { contextId: id, outcome: "helped" };
}

const PROTECTED_ID = String(DEMO_DELTAS["auto-refund-ceiling"].id);
const ESCALATION_ID = String(DEMO_DELTAS["escalation-aggressiveness"].id);

function evaluateCallsFor(deltaId: string) {
  return spy.evaluate.filter((c) => c.deltaId === deltaId);
}
function arbitrateCallsFor(deltaId: string) {
  return spy.arbitrate.filter((c) => c.deltaId === deltaId);
}
function lastArbitrateFor(deltaId: string) {
  const calls = arbitrateCallsFor(deltaId);
  const last = calls[calls.length - 1];
  if (last === undefined) throw new Error(`arbitrate was never called for ${deltaId}`);
  return last;
}
function lastEpisodesFor(deltaId: string): readonly Episode[] {
  const last = spy.lastEpisodes.get(deltaId);
  if (last === undefined) throw new Error(`evaluateDelta was never called for ${deltaId}`);
  return last;
}
/** The counts an `EvidenceTally` carries, without its `deltaId`. */
function countsOf(tally: EvidenceTally) {
  return { distinctContexts: tally.distinctContexts, helped: tally.helped, neutral: tally.neutral, harmed: tally.harmed };
}

beforeEach(() => {
  spy.evaluate.length = 0;
  spy.lastEpisodes.clear();
  spy.arbitrate.length = 0;
});

describe("auto-refund-ceiling: its episodes are passed to evaluateDelta, and arbitrate is handed a tally of them, yet rules frozen", () => {
  for (const count of [3, 500, 10_000]) {
    it(`${count} distinct helped episodes: evaluateDelta is called with a list growing 0..${count}, ending in exactly those ${count} episodes in order, and arbitrate receives a ${count}-distinct / ${count}-helped tally with gateResult "frozen" every time`, () => {
      const inputs = Array.from({ length: count }, (_, i) => helped(`tck-${i}`));
      const view = computeKnobView("auto-refund-ceiling", inputs);

      // evaluateDelta: called once with the empty list, then once after each episode, each time
      // with one more episode than the call before — never with a shorter or empty list.
      const evaluateCalls = evaluateCallsFor(PROTECTED_ID);
      expect(evaluateCalls.map((c) => c.length)).toEqual(Array.from({ length: count + 1 }, (_, i) => i));
      expect(evaluateCalls.every((c) => c.priorKind === "vacant")).toBe(true);

      // The last list it was called with is exactly the input history, in order, under this
      // knob's own delta id.
      const lastEpisodes = lastEpisodesFor(PROTECTED_ID);
      expect(lastEpisodes).toHaveLength(count);
      expect(lastEpisodes.every((e) => String(e.deltaId) === PROTECTED_ID && e.outcome === "helped")).toBe(true);
      expect(lastEpisodes.map((e) => String(e.contextId))).toEqual(inputs.map((input) => input.contextId));

      // arbitrate: handed a tally that counts all of them, with a frozen gate verdict, on every call
      // — and it returns frozen on every call, so the evidence was present and did not decide.
      const arbitrateCalls = arbitrateCallsFor(PROTECTED_ID);
      expect(arbitrateCalls).toHaveLength(count + 1);
      expect(arbitrateCalls.every((c) => c.gateResult === "frozen" && c.decisionKind === "frozen")).toBe(true);
      const last = lastArbitrateFor(PROTECTED_ID);
      expect(last.tally.deltaId).toBe(PROTECTED_ID);
      expect(countsOf(last.tally)).toEqual({ distinctContexts: count, helped: count, neutral: 0, harmed: 0 });

      expect(view.decision.kind).toBe("frozen");
    });
  }
});

describe("the same three helped tickets reach arbitrate identically for both knobs; only the gate verdict differs", () => {
  it("escalation-aggressiveness: tally 3/3/0/0, gateResult eligible, adopt. auto-refund-ceiling: the same counts, gateResult frozen, frozen", () => {
    const inputs = [helped("tck-4471"), helped("tck-5002"), helped("tck-5108")];
    const escalation = computeKnobView("escalation-aggressiveness", inputs);
    const protectedView = computeKnobView("auto-refund-ceiling", inputs);

    const escalationLast = lastArbitrateFor(ESCALATION_ID);
    const protectedLast = lastArbitrateFor(PROTECTED_ID);

    expect(countsOf(escalationLast.tally)).toEqual({ distinctContexts: 3, helped: 3, neutral: 0, harmed: 0 });
    expect(countsOf(protectedLast.tally)).toEqual(countsOf(escalationLast.tally));

    expect(escalationLast.gateResult).toBe("eligible");
    expect(protectedLast.gateResult).toBe("frozen");
    expect(escalationLast.decisionKind).toBe("adopt");
    expect(protectedLast.decisionKind).toBe("frozen");
    expect(escalation.decision.kind).toBe("adopt");
    expect(protectedView.decision.kind).toBe("frozen");

    // And the lists evaluateDelta was last called with are the same three episodes, in the same order.
    expect(lastEpisodesFor(PROTECTED_ID).map((e) => String(e.contextId))).toEqual(
      lastEpisodesFor(ESCALATION_ID).map((e) => String(e.contextId)),
    );
  });
});
