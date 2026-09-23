import { describe, expect, it } from "vitest";
import { tally } from "../tally.js";
import { CONTEXTS, DELTA, OTHER_DELTA, episode } from "./fixtures.js";

describe("tally — basic counting", () => {
  it("an empty episode list tallies to all zeros for the given delta — a fresh, not-yet-evidenced delta is a legitimate call, not a failure", () => {
    const result = tally(DELTA, []);
    expect(result).toEqual({
      ok: true,
      tally: { deltaId: DELTA, distinctContexts: 0, helped: 0, neutral: 0, harmed: 0 },
    });
  });

  it("one episode from one context tallies to distinctContexts: 1", () => {
    const result = tally(DELTA, [episode(DELTA, CONTEXTS.a, "helped")]);
    expect(result).toEqual({
      ok: true,
      tally: { deltaId: DELTA, distinctContexts: 1, helped: 1, neutral: 0, harmed: 0 },
    });
  });

  it("three episodes from three distinct contexts tally to distinctContexts: 3, counting helped/neutral/harmed separately", () => {
    const result = tally(DELTA, [
      episode(DELTA, CONTEXTS.a, "helped"),
      episode(DELTA, CONTEXTS.b, "neutral"),
      episode(DELTA, CONTEXTS.c, "harmed"),
    ]);
    expect(result).toEqual({
      ok: true,
      tally: { deltaId: DELTA, distinctContexts: 3, helped: 1, neutral: 1, harmed: 1 },
    });
  });
});

describe("tally — THE CENTRAL REFUSAL: dedups strictly by contextId, never by episode count", () => {
  it("a replay storm of 50 episodes from a SINGLE context counts as ONE context, not fifty — the project's whole conceptual spine", () => {
    const storm = Array.from({ length: 50 }, (_, i) =>
      episode(DELTA, CONTEXTS.a, i % 2 === 0 ? "helped" : "harmed", `2026-09-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`),
    );
    const result = tally(DELTA, storm);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    // distinctContexts is 1 — NOT 50, NOT storm.length, regardless of how
    // many of the 50 episodes there are or what outcome each carries.
    expect(result.tally.distinctContexts).toBe(1);
    // The episode-level counts are NOT collapsed — 50 real episodes were
    // still counted individually for helped/neutral/harmed. Only
    // distinctContexts dedups; a delta with 200 "helped" episodes all from
    // one context still shows 200 "helped" — the plan is explicit these
    // two numbers are allowed to diverge, on purpose.
    expect(result.tally.helped + result.tally.neutral + result.tally.harmed).toBe(50);
    expect(result.tally.helped).toBe(25);
    expect(result.tally.harmed).toBe(25);
  });

  it("500 episodes from a single context still counts as one context (the plan's own named scale, one order of magnitude past the 50 the task calls for)", () => {
    const storm = Array.from({ length: 500 }, (_, i) => episode(DELTA, CONTEXTS.b, "helped", `2026-09-01T00:00:${String(i % 60).padStart(2, "0")}.000Z`));
    const result = tally(DELTA, storm);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.tally.distinctContexts).toBe(1);
    expect(result.tally.helped).toBe(500);
  });

  it("50 episodes from ONE real context plus 2 episodes from 2 OTHER distinct contexts tallies to distinctContexts: 3 — the storm doesn't drown out (or inflate) genuinely separate corroboration", () => {
    const storm = Array.from({ length: 50 }, () => episode(DELTA, CONTEXTS.a, "helped"));
    const episodes = [...storm, episode(DELTA, CONTEXTS.b, "helped"), episode(DELTA, CONTEXTS.c, "harmed")];
    const result = tally(DELTA, episodes);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.tally.distinctContexts).toBe(3);
    expect(result.tally.helped).toBe(51);
    expect(result.tally.harmed).toBe(1);
  });
});

describe("tally — mismatched-delta-episode: never silently attributes another delta's evidence to this one", () => {
  it("an episode whose own deltaId does not match the delta being tallied for is refused, not silently counted", () => {
    const result = tally(DELTA, [episode(DELTA, CONTEXTS.a, "helped"), episode(OTHER_DELTA, CONTEXTS.b, "helped")]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("mismatched-delta-episode");
  });
});
