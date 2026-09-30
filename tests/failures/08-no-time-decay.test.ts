import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { episode, VACANT } from "./helpers.js";

/**
 * ============================================================
 * CASE 8 — NO TIME DECAY ON EPISODES (`.genesis/PLAN.md` §4, case 7,
 * verbatim)
 * ============================================================
 * KIND: DISCLOSES A DELIBERATE, DISCLOSED NON-GOAL.
 *
 * THE GAP, STATED PLAINLY: an episode from over a year ago counts toward
 * a delta's tally exactly as much as one from five minutes ago —
 * `EvidenceTally` carries no time dimension at all, and
 * `lib/evidence/tally.ts` never reads `observedAt` for anything but
 * display (confirmed directly: `lib/evidence/tally.ts`'s own
 * `computeTally` reads only `deltaId`/`contextId`/`outcome` off each
 * episode). `lib/contracts/timestamp.ts`'s own header names this as
 * deliberate: "unlike a project that needs `now`-relative freshness math
 * at this layer... `EvidenceTally` carries no time dimension at all."
 *
 * WHY THIS IS A DELIBERATE NON-GOAL, NOT AN OVERSIGHT: `.genesis/PLAN.md`
 * §6 records time-decayed evidence as "considered and rejected" — borrowing
 * `memory-ledger`'s own decay machinery would blur this project's spine
 * into a sibling's. This case exists to pin that the resulting behavior
 * (no decay at all) is real and observable, not merely asserted in prose.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THIS NON-GOAL WAS
 * REVISITED): `lib/evidence/tally.ts` reading `observedAt` to discount or
 * exclude old episodes — at which point the two scenarios below, which
 * currently produce byte-identical decisions, would start to diverge.
 */
describe("CASE 8 (DISCLOSES): an episode from over a year ago counts exactly as much as one from minutes ago", () => {
  it("a delta corroborated by three episodes dated more than a year apart from each other adopts identically to one corroborated by three episodes minutes apart", () => {
    const oldDelta = proposeDelta({
      id: "failure-case-8-delta-old",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.7,
      proposedAt: "2024-01-01T00:00:00Z",
    });
    const recentDelta = proposeDelta({
      id: "failure-case-8-delta-recent",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.7,
      proposedAt: "2026-03-01T00:00:00Z",
    });

    // Same three contexts, same three outcomes — only observedAt differs,
    // and by more than a year in the first scenario.
    const spreadOverAYear = [
      episode(oldDelta.id, "tck-old-1", "helped", "2024-01-05T00:00:00Z"),
      episode(oldDelta.id, "tck-old-2", "helped", "2024-06-15T00:00:00Z"),
      episode(oldDelta.id, "tck-old-3", "helped", "2025-08-20T00:00:00Z"),
    ];
    const minutesApart = [
      episode(recentDelta.id, "tck-recent-1", "helped", "2026-03-01T09:00:00Z"),
      episode(recentDelta.id, "tck-recent-2", "helped", "2026-03-01T09:03:00Z"),
      episode(recentDelta.id, "tck-recent-3", "helped", "2026-03-01T09:06:00Z"),
    ];

    const oldResult = evaluateDelta(oldDelta, spreadOverAYear, VACANT);
    const recentResult = evaluateDelta(recentDelta, minutesApart, VACANT);
    expect(oldResult.ok).toBe(true);
    expect(recentResult.ok).toBe(true);
    if (!oldResult.ok || !recentResult.ok) return;

    expect(oldResult.decision.kind).toBe("adopt");
    expect(recentResult.decision.kind).toBe("adopt");
    // The two tallies are structurally identical (same counts) — only
    // deltaId differs, confirming the decision does not depend on WHEN
    // the episodes happened, only on distinctness and outcome.
    expect(oldResult.decision.kind === "adopt" && recentResult.decision.kind === "adopt" &&
      oldResult.decision.tally.distinctContexts === recentResult.decision.tally.distinctContexts &&
      oldResult.decision.tally.helped === recentResult.decision.tally.helped).toBe(true);
  });

  it("a single ancient episode (year 2000) and a single episode from a moment ago produce the identical tally when substituted for one another, changing nothing but observedAt", () => {
    const delta = proposeDelta({
      id: "failure-case-8-single",
      knob: "response-directness",
      from: 0.4,
      to: 0.6,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const ancient = evaluateDelta(delta, [episode(delta.id, "tck-single", "helped", "2000-01-01T00:00:00Z")], VACANT);
    const fresh = evaluateDelta(delta, [episode(delta.id, "tck-single", "helped", "2026-03-01T00:00:00Z")], VACANT);
    expect(ancient.ok).toBe(true);
    expect(fresh.ok).toBe(true);
    if (!ancient.ok || !fresh.ok) return;
    // Both are 'hold' (1 distinct context, short of the bar) — the point
    // is they are the SAME decision regardless of the 26-year gap.
    expect(ancient.decision.kind).toBe(fresh.decision.kind);
    expect(ancient.decision.kind === "hold" && fresh.decision.kind === "hold" &&
      ancient.decision.distinctContextsNeeded === fresh.decision.distinctContextsNeeded).toBe(true);
  });
});
