import { describe, expect, it } from "vitest";
import {
  DEMO_DELTAS,
  DEMO_KNOB_IDS,
  computeKnobView,
  type KnobView,
  type RawEpisodeInput,
} from "../compute-demo-view.js";
import type { Episode } from "../../lib/contracts/episode.js";
import { AUTO_REFUND_CEILING_INVARIANT } from "../../domains/support-triage/invariants.js";

/**
 * `components/__tests__/compute-demo-view.test.ts` — falsifiable tests for M8's one view-model
 * function. Every test drives `computeKnobView` exactly the way `AdaptiveAgentDemo.tsx` does:
 * an ordered array of `RawEpisodeInput` a person could actually type/select in the form, never
 * a hand-built `Episode`/`EvidenceTally`/`AdaptationDecision` asserted independently of a real
 * call. See `.genesis/decisions/0008-demo.md` for the gutting and mutation experiments this suite
 * was run against.
 *
 * EVERY TALLY ASSERTION BELOW PINS ALL FOUR COUNTS (`distinctContexts`, `helped`, `neutral`,
 * `harmed`), never `distinctContexts` alone. The first revision of this file asserted
 * `distinctContexts` in only a couple of tests and `helped`/`neutral`/`harmed` in none, so a
 * mutant that kept `distinctContexts` correct and zeroed `helped` (an `adopt` that cites no
 * helpful evidence) passed the whole suite — see ADR 0008, "Round 2".
 */

function helped(id: string): RawEpisodeInput {
  return { contextId: id, outcome: "helped" };
}
function neutral(id: string): RawEpisodeInput {
  return { contextId: id, outcome: "neutral" };
}
function harmed(id: string): RawEpisodeInput {
  return { contextId: id, outcome: "harmed" };
}

/** The four counts `EvidenceTally` carries, minus `deltaId`. Throws (rather than returning `undefined`) for a `frozen` decision, which carries no tally by construction. */
function counts(view: KnobView): { distinctContexts: number; helped: number; neutral: number; harmed: number } {
  const decision = view.decision;
  if (decision.kind === "frozen") throw new Error("a frozen decision carries no tally");
  const { distinctContexts, helped: h, neutral: n, harmed: x } = decision.tally;
  return { distinctContexts, helped: h, neutral: n, harmed: x };
}

function needed(view: KnobView): number {
  if (view.decision.kind !== "hold") throw new Error(`expected hold, got ${view.decision.kind}`);
  return view.decision.distinctContextsNeeded;
}

function revertedTo(view: KnobView): number {
  if (view.decision.kind !== "revert") throw new Error(`expected revert, got ${view.decision.kind}`);
  return view.decision.revertedTo;
}

describe("escalation-aggressiveness: hold -> hold -> adopt -> revert, the headline non-frozen story", () => {
  it("zero episodes -> TRIAL phase, hold, needs 3 more distinct contexts, empty tally", () => {
    const view = computeKnobView("escalation-aggressiveness", []);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("hold");
    expect(needed(view)).toBe(3);
    expect(counts(view)).toEqual({ distinctContexts: 0, helped: 0, neutral: 0, harmed: 0 });
  });

  it("2 distinct helped episodes -> still TRIAL, hold, needs 1 more, tally 2 distinct / 2 helped", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1"), helped("tck-2")]);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("hold");
    expect(needed(view)).toBe(1);
    expect(counts(view)).toEqual({ distinctContexts: 2, helped: 2, neutral: 0, harmed: 0 });
  });

  it("3 distinct helped episodes -> flips to LIVE, adopt ON THE LAST EPISODE, citing the real 3-distinct / 3-helped tally", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1"), helped("tck-2"), helped("tck-3")]);
    expect(view.phase).toBe("live");
    expect(view.decision.kind).toBe("adopt");
    // The decision that CAUSED the adoption is the current decision until the next episode arrives:
    // it must carry the trial pool's real evidence, not an empty post-adoption monitoring tally.
    expect(counts(view)).toEqual({ distinctContexts: 3, helped: 3, neutral: 0, harmed: 0 });
    expect(view.trialEpisodes).toHaveLength(3);
    expect(view.monitoringEpisodes).toHaveLength(0);
  });

  it("2 helped + 1 neutral across 3 distinct contexts -> adopt, and the tally carries the neutral episode", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1"), helped("tck-2"), neutral("tck-3")]);
    expect(view.phase).toBe("live");
    expect(view.decision.kind).toBe("adopt");
    expect(counts(view)).toEqual({ distinctContexts: 3, helped: 2, neutral: 1, harmed: 0 });
  });

  it("3 distinct NEUTRAL episodes -> hold with distinctContextsNeeded 0 (no helped-majority), tally 3 distinct / 3 neutral", () => {
    const view = computeKnobView("escalation-aggressiveness", [neutral("tck-1"), neutral("tck-2"), neutral("tck-3")]);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("hold");
    expect(needed(view)).toBe(0);
    expect(counts(view)).toEqual({ distinctContexts: 3, helped: 0, neutral: 3, harmed: 0 });
  });

  it("one post-adoption harmed episode is NOT enough to revert (asymmetric bar, but not zero); the tally is the monitoring pool's alone", () => {
    const view = computeKnobView("escalation-aggressiveness", [
      helped("tck-1"),
      helped("tck-2"),
      helped("tck-3"),
      harmed("tck-4"),
    ]);
    expect(view.phase).toBe("live");
    expect(view.decision.kind).toBe("adopt");
    // A FRESH post-adoption pool: the 3 trial-phase helped episodes do not leak into it.
    expect(counts(view)).toEqual({ distinctContexts: 1, helped: 0, neutral: 0, harmed: 1 });
    expect(view.monitoringEpisodes).toHaveLength(1);
  });

  it("a SECOND distinct post-adoption harmed episode flips it to revert ON THE LAST EPISODE, rolling back to delta.from, citing the real 2-distinct / 2-harmed tally", () => {
    const view = computeKnobView("escalation-aggressiveness", [
      helped("tck-1"),
      helped("tck-2"),
      helped("tck-3"),
      harmed("tck-4"),
      harmed("tck-5"),
    ]);
    expect(view.phase).toBe("live");
    expect(view.decision.kind).toBe("revert");
    expect(revertedTo(view)).toBe(DEMO_DELTAS["escalation-aggressiveness"].from);
    expect(counts(view)).toEqual({ distinctContexts: 2, helped: 0, neutral: 0, harmed: 2 });
    expect(view.monitoringEpisodes).toHaveLength(2);
  });

  it("FALSIFIABILITY: a same-context replay storm never reaches adopt — 50 repeats of one ticket is distinctContexts: 1 with helped: 50", () => {
    const storm = Array.from({ length: 50 }, () => helped("tck-1"));
    const view = computeKnobView("escalation-aggressiveness", storm);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("hold");
    expect(needed(view)).toBe(2);
    // Volume is counted (50 helped episodes) but diversity is not (1 distinct context) — both pinned.
    expect(counts(view)).toEqual({ distinctContexts: 1, helped: 50, neutral: 0, harmed: 0 });
  });
});

describe("response-directness: the contextId-identity limit, exercised honestly", () => {
  it("the same ticket typed three ways (case + whitespace) counts as three distinct contexts and clears adopt", () => {
    const view = computeKnobView("response-directness", [helped("tck-9001"), helped("TCK-9001"), helped(" tck-9001 ")]);
    expect(view.phase).toBe("live");
    expect(view.decision.kind).toBe("adopt");
    expect(counts(view)).toEqual({ distinctContexts: 3, helped: 3, neutral: 0, harmed: 0 });
  });

  it("the identical ticket typed the SAME way three times stays exactly one context and holds", () => {
    const view = computeKnobView("response-directness", [helped("tck-9001"), helped("tck-9001"), helped("tck-9001")]);
    expect(view.phase).toBe("trial");
    expect(view.decision.kind).toBe("hold");
    expect(needed(view)).toBe(2);
    expect(counts(view)).toEqual({ distinctContexts: 1, helped: 3, neutral: 0, harmed: 0 });
  });
});

describe("auto-refund-ceiling: frozen, unconditionally, regardless of evidence", () => {
  const FROZEN_DECISION = {
    kind: "frozen",
    deltaId: DEMO_DELTAS["auto-refund-ceiling"].id,
    invariant: AUTO_REFUND_CEILING_INVARIANT.id,
  };

  it("zero episodes -> frozen, citing this domain's own invariant id, with no evidence-shaped field at all", () => {
    const view = computeKnobView("auto-refund-ceiling", []);
    expect(view.phase).toBe("trial");
    expect(view.decision).toEqual(FROZEN_DECISION);
    expect(Object.keys(view.decision).sort()).toEqual(["deltaId", "invariant", "kind"]);
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
    expect(overwhelmed.decision).toEqual(FROZEN_DECISION);
    // Identical ruling, evidence or none — evidence quantity never reaches this decision at all.
    expect(overwhelmed.decision).toEqual(zero.decision);
    expect(overwhelmed.trialEpisodes).toHaveLength(5);
  });

  it("10,000 synthetic helped episodes across 10,000 distinct contexts still resolves frozen", () => {
    const flood = Array.from({ length: 10_000 }, (_, i) => helped(`tck-flood-${i}`));
    const view = computeKnobView("auto-refund-ceiling", flood);
    expect(view.decision).toEqual(FROZEN_DECISION);
    // Not vacuous: all 10,000 really reached the engine. A view-model that dropped them before
    // evaluating would also report "frozen", and this assertion is what tells the two apart.
    expect(view.trialEpisodes).toHaveLength(10_000);
  });

  it("never leaves the trial phase, no matter how much evidence piles up", () => {
    const view = computeKnobView("auto-refund-ceiling", Array.from({ length: 500 }, (_, i) => helped(`tck-${i}`)));
    expect(view.phase).toBe("trial");
    expect(view.trialEpisodes).toHaveLength(500);
    expect(view.monitoringEpisodes).toHaveLength(0);
  });
});

describe("every displayed value is the real engine's tally of the episodes actually shown", () => {
  /** An independent recount, written here from scratch rather than imported from the engine — a deliberately second, simpler implementation to check the first one's output against. */
  function recount(episodes: readonly Episode[]) {
    return {
      distinctContexts: new Set(episodes.map((e) => String(e.contextId))).size,
      helped: episodes.filter((e) => e.outcome === "helped").length,
      neutral: episodes.filter((e) => e.outcome === "neutral").length,
      harmed: episodes.filter((e) => e.outcome === "harmed").length,
    };
  }

  // Repeats a context id (tck-1 again at the end, tck-4 with two outcomes), mixes all three
  // outcomes, and runs long enough to cross trial -> live -> monitoring.
  const MIXED: readonly RawEpisodeInput[] = [
    helped("tck-1"),
    helped("tck-2"),
    helped("tck-3"),
    harmed("tck-4"),
    helped("tck-4"),
    neutral("tck-5"),
    harmed("tck-6"),
    harmed("tck-7"),
    helped("tck-1"),
  ];

  for (const knobId of DEMO_KNOB_IDS) {
    it(`${knobId}: at every prefix of a mixed 9-episode history, ids match, episodes are kept in order, and the tally equals an independent recount`, () => {
      const delta = DEMO_DELTAS[knobId];
      for (let length = 0; length <= MIXED.length; length += 1) {
        const prefix = MIXED.slice(0, length);
        const view = computeKnobView(knobId, prefix);

        expect(view.delta).toBe(delta);
        expect(view.decision.deltaId).toBe(delta.id);

        // Every episode handed to the engine carries THIS knob's own delta id — the construction
        // property that keeps tally.deltaId === delta.id — and nothing is dropped or reordered.
        const all = [...view.trialEpisodes, ...view.monitoringEpisodes];
        expect(all.every((e) => e.deltaId === delta.id)).toBe(true);
        expect(all.map((e) => ({ contextId: String(e.contextId), outcome: e.outcome }))).toEqual(prefix);

        if (view.decision.kind === "frozen") continue;
        expect(view.decision.tally.deltaId).toBe(delta.id);
        // Which pool the current decision was computed from: the monitoring pool once it has any
        // episode in it, otherwise (including the instant of adoption, when the monitoring pool is
        // still empty) the trial pool that produced it.
        const pool = view.monitoringEpisodes.length > 0 ? view.monitoringEpisodes : view.trialEpisodes;
        expect(counts(view)).toEqual(recount(pool));
      }
    });
  }
});

describe("no string a text field can produce makes the view-model throw", () => {
  // A FIXED adversarial corpus, not a proof: the empty string, whitespace, NUL, a right-to-left
  // override, a lone surrogate, names that collide with Object.prototype members, and a 1 MiB
  // string. (An independent verifier separately fuzzed 4,000 random calls with zero throws.)
  const CORPUS: readonly string[] = [
    "",
    " ",
    "\t\n",
    "\u0000",
    "‮",
    "\ud800",
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
    "null",
    "undefined",
    "🙂",
    "tck-1\n",
    "x".repeat(1_048_576),
  ];

  for (const knobId of DEMO_KNOB_IDS) {
    it(`${knobId}: every corpus string, as every outcome, alone and combined, evaluates without throwing`, () => {
      for (const contextId of CORPUS) {
        for (const outcome of ["helped", "neutral", "harmed"] as const) {
          expect(() => computeKnobView(knobId, [{ contextId, outcome }])).not.toThrow();
        }
      }
      expect(() => computeKnobView(knobId, CORPUS.map((contextId) => helped(contextId)))).not.toThrow();
      expect(() => computeKnobView(knobId, CORPUS.map((contextId) => harmed(contextId)))).not.toThrow();
    });
  }

  it("the 15 corpus strings are 15 distinct contexts: an all-helped history adopts escalation-aggressiveness at the third, and the other 12 land in the monitoring pool as 12 distinct", () => {
    const view = computeKnobView("escalation-aggressiveness", CORPUS.map((contextId) => helped(contextId)));
    // Adopts at the third distinct episode; the remaining 12 go to the fresh monitoring pool.
    expect(view.phase).toBe("live");
    expect(view.trialEpisodes).toHaveLength(3);
    expect(view.monitoringEpisodes).toHaveLength(12);
    expect(view.decision.kind).toBe("adopt");
    expect(counts(view)).toEqual({ distinctContexts: 12, helped: 12, neutral: 0, harmed: 0 });
  });
});

describe("purity and construction invariants", () => {
  it("computeKnobView is pure: the same input list produces a deep-equal view every time", () => {
    const inputs = [helped("tck-1"), helped("tck-2"), harmed("tck-3")];
    const first = computeKnobView("escalation-aggressiveness", inputs);
    const second = computeKnobView("escalation-aggressiveness", inputs);
    expect(second).toEqual(first);
  });

  it("computeKnobView does not mutate the input history it is handed", () => {
    const inputs: RawEpisodeInput[] = [helped("tck-1"), helped("tck-2"), helped("tck-3"), harmed("tck-4")];
    const snapshot = structuredClone(inputs);
    computeKnobView("escalation-aggressiveness", inputs);
    expect(inputs).toEqual(snapshot);
  });

  it("the three demo deltas have three distinct, hardcoded BehaviorDeltaIds (pins the constants only, not arbitrate's own consistency check)", () => {
    const ids = DEMO_KNOB_IDS.map((knobId) => DEMO_DELTAS[knobId].id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each demo delta's own knob field matches the key it's registered under", () => {
    for (const knobId of DEMO_KNOB_IDS) {
      expect(DEMO_DELTAS[knobId].knob).toBe(knobId);
    }
  });
});
