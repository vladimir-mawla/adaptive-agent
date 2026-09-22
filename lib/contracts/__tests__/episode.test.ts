import { describe, expect, it } from "vitest";
import type { Episode } from "../episode.js";
import { ALL_EPISODE_OUTCOMES } from "../episode.js";
import { behaviorDeltaId, contextId } from "../ids.js";
import { timestamp } from "../timestamp.js";

const DELTA = behaviorDeltaId("delta-1");
const CONTEXT = contextId("ticket-42");
const WHEN = timestamp("2026-09-23T00:00:00.000Z");

describe("Episode.outcome is closed to helped | neutral | harmed, never a free-text or numeric score", () => {
  it("accepts every legal outcome", () => {
    for (const outcome of ALL_EPISODE_OUTCOMES) {
      const episode: Episode = { deltaId: DELTA, contextId: CONTEXT, outcome, observedAt: WHEN };
      expect(episode.outcome).toBe(outcome);
    }
    expect(ALL_EPISODE_OUTCOMES).toHaveLength(3);
  });

  it("TYPE-LEVEL: a free-text outcome does not compile", () => {
    // @ts-expect-error — "great" is not a member of the closed EpisodeOutcome union; no numeric score or free text may stand in for it.
    const episode: Episode = { deltaId: DELTA, contextId: CONTEXT, outcome: "great", observedAt: WHEN };
    expect(episode).toBeDefined();
  });

  it("TYPE-LEVEL: a numeric outcome does not compile", () => {
    // @ts-expect-error — a numeric score is exactly what plan §2 refuses as a stand-in for the closed three-value outcome.
    const episode: Episode = { deltaId: DELTA, contextId: CONTEXT, outcome: 0.9, observedAt: WHEN };
    expect(episode).toBeDefined();
  });
});
