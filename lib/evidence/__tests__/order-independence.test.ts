import { describe, expect, it } from "vitest";
import { tally } from "../tally.js";
import { CONTEXTS, DELTA, episode, mulberry32, randomEpisode, shuffle } from "./fixtures.js";
import type { Episode } from "../../contracts/episode.js";

/**
 * Plan §3 M3's own falsifiability check, verbatim: "a permutation sweep
 * over a fixed multi-context scenario proves order-independence." This
 * file is that proof, done two ways: (1) EVERY permutation of a small,
 * fixed episode set (5! = 120, exhaustive, not sampled), and (2) a
 * property-based sweep over many RANDOMLY GENERATED episode sets, each
 * checked against several random shuffles, using a seeded PRNG
 * (`fixtures.ts`) so a failure is reproducible by its printed seed.
 *
 * THE GENERATOR'S OWN POOL SIZE IS THE LOAD-BEARING PART OF THIS FILE,
 * NOT AN INCIDENTAL DETAIL: this milestone's own task names the exact
 * failure mode to avoid — "a 300-scenario property test that was
 * structurally incapable of generating the one case that turned out
 * exploitable... because every id was derived from fields that are
 * always distinct." `randomEpisode` (`fixtures.ts`) draws `contextId`
 * from a pool of only THREE values, not a fresh id per call — so with
 * `EPISODES_PER_SCENARIO` set well above 3, most generated scenarios
 * contain real, repeated `contextId` collisions BY CONSTRUCTION, not by
 * luck. The "sanity" test at the bottom of this file confirms that
 * directly: it asserts the generator actually produced
 * `distinctContexts < episodes.length` (a genuine collision) in at least
 * one scenario, so a passing suite here is not vacuously trivial the way
 * a from-scratch-unique-id generator's suite would be.
 */

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const [head, ...rest] = items;
  const subPerms = permutations(rest);
  const result: T[][] = [];
  for (const perm of subPerms) {
    for (let i = 0; i <= perm.length; i++) {
      result.push([...perm.slice(0, i), head as T, ...perm.slice(i)]);
    }
  }
  return result;
}

describe("tally — exhaustive permutation proof (fixed scenario)", () => {
  it("every one of the 5! = 120 orderings of a 5-episode, 3-context scenario (including a repeated context) produces the identical EvidenceTally", () => {
    const episodes: Episode[] = [
      episode(DELTA, CONTEXTS.a, "helped"),
      episode(DELTA, CONTEXTS.a, "harmed"), // same context as the first — a real collision, not a distinct id
      episode(DELTA, CONTEXTS.b, "helped"),
      episode(DELTA, CONTEXTS.c, "neutral"),
      episode(DELTA, CONTEXTS.c, "helped"), // same context as the fourth
    ];
    const baseline = tally(DELTA, episodes);
    expect(baseline).toEqual({
      ok: true,
      tally: { deltaId: DELTA, distinctContexts: 3, helped: 3, neutral: 1, harmed: 1 },
    });

    const allOrderings = permutations(episodes);
    expect(allOrderings).toHaveLength(120);
    for (const ordering of allOrderings) {
      expect(tally(DELTA, ordering)).toEqual(baseline);
    }
  });

  it("50 identical-context episodes plus 2 genuinely distinct ones — every ordering still reports distinctContexts: 3", () => {
    const storm = Array.from({ length: 50 }, () => episode(DELTA, CONTEXTS.a, "helped"));
    const episodes = [...storm, episode(DELTA, CONTEXTS.b, "harmed"), episode(DELTA, CONTEXTS.c, "neutral")];
    const baseline = tally(DELTA, episodes);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) throw new Error("unreachable");
    expect(baseline.tally.distinctContexts).toBe(3);

    // 52! is too large to enumerate — sampled with 200 random shuffles
    // instead of the exhaustive sweep above, which is exercised separately
    // by the seeded property-based sweep below anyway.
    const rand = mulberry32(2026);
    for (let i = 0; i < 200; i++) {
      expect(tally(DELTA, shuffle(episodes, rand))).toEqual(baseline);
    }
  });
});

describe("tally — property-based order-independence over randomly generated episode sets (small id pool, collisions guaranteed to occur)", () => {
  const SCENARIOS = 150;
  const EPISODES_PER_SCENARIO_MAX = 12; // well above the 3-context pool size, so repeats are common, not rare
  const SHUFFLES_PER_SCENARIO = 5;

  for (let scenarioIndex = 0; scenarioIndex < SCENARIOS; scenarioIndex++) {
    it(`scenario seed=${scenarioIndex}: any shuffle of a randomly generated episode set produces the exact same TallyResult`, () => {
      const genRand = mulberry32(scenarioIndex * 7919 + 13);
      const episodeCount = 1 + Math.floor(genRand() * EPISODES_PER_SCENARIO_MAX);
      const episodes = Array.from({ length: episodeCount }, () => randomEpisode(DELTA, genRand));

      const baseline = tally(DELTA, episodes);
      expect(baseline.ok).toBe(true);

      for (let shuffleIndex = 0; shuffleIndex < SHUFFLES_PER_SCENARIO; shuffleIndex++) {
        const shuffleRand = mulberry32(scenarioIndex * 104_729 + shuffleIndex * 31 + 1);
        const shuffled = shuffle(episodes, shuffleRand);
        expect(tally(DELTA, shuffled)).toEqual(baseline);
      }
    });
  }

  it("CONFIRMS THE GENERATOR CAN ACTUALLY PRODUCE THE CASE THAT MATTERS: at least one scenario above has distinctContexts strictly less than its own episode count (a genuine collision, not a suite of scenarios that happen to avoid the one case this function exists to handle)", () => {
    let sawAGenuineCollision = false;
    let sawMultipleDistinctContexts = false;
    for (let scenarioIndex = 0; scenarioIndex < SCENARIOS; scenarioIndex++) {
      const genRand = mulberry32(scenarioIndex * 7919 + 13);
      const episodeCount = 1 + Math.floor(genRand() * EPISODES_PER_SCENARIO_MAX);
      const episodes = Array.from({ length: episodeCount }, () => randomEpisode(DELTA, genRand));
      const result = tally(DELTA, episodes);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      if (result.tally.distinctContexts < episodes.length) sawAGenuineCollision = true;
      if (result.tally.distinctContexts > 1) sawMultipleDistinctContexts = true;
    }
    // Both directions checked — a generator that always collides everything
    // to 1 context would be just as unable to prove this function's
    // behavior on genuinely independent evidence as one that never collides
    // at all.
    expect(sawAGenuineCollision).toBe(true);
    expect(sawMultipleDistinctContexts).toBe(true);
  });
});
