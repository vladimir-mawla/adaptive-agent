import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { episode, VACANT } from "./helpers.js";

/**
 * ============================================================
 * CASE 11 — A RAW-COUNT MAJORITY CAN BE DOMINATED BY ONE CONTEXT'S
 * EPISODE VOLUME (a limit disclosed in `.genesis/decisions/
 * 0005-arbitration.md` Decision 8, not in the plan's own original sketch)
 * ============================================================
 * KIND: DISCLOSES A REAL, UNSOLVED GAP.
 *
 * THE GAP, STATED PLAINLY: `EvidenceTally` (M1, FROZEN) carries
 * `helped`/`neutral`/`harmed` as plain per-EPISODE counts, not
 * per-distinct-context counts — there is no way, from `EvidenceTally`
 * alone, to know how many of the `distinctContexts` contributed a
 * `helped` episode versus a `harmed` one. `0005-arbitration.md` names
 * this directly: "a delta can clear `distinctContexts >= 3` from... one
 * dominant context contributing thousands of `helped` episodes plus two
 * contexts each contributing a single `harmed` episode, and still
 * register a 'helped-majority' by raw count even though a MAJORITY OF THE
 * DISTINCT CONTEXTS actually said `harmed`."
 *
 * DISTINCT FROM CASE 1 (same-context replay storm): case 1 is about a
 * storm from ONE context alone, which correctly never adopts (it never
 * even reaches `distinctContexts >= 3`). This case is different and more
 * subtle — the storm's dominant context is combined WITH enough genuinely
 * distinct contexts to legitimately clear the distinct-context bar, and
 * it is the MAJORITY CHECK, not the distinct-context bar, that gets
 * misled by raw volume.
 *
 * WHY THIS IS NOT CLOSEABLE FROM `arbitrate`'s OWN SIGNATURE:
 * `arbitrate(delta, tally: EvidenceTally, ...)` (M5, FROZEN) has no
 * access to a per-context outcome breakdown to check this more precisely
 * even if it wanted to — `lib/evidence/tally.ts` (M3, FROZEN) does not
 * expose one, and both layers are frozen for this milestone.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED):
 * `EvidenceTally` gaining a per-context outcome breakdown, and
 * `arbitrate`'s majority check being computed over DISTINCT CONTEXTS
 * ("how many contexts said helped vs. harmed") rather than raw episode
 * counts — at which point the scenario below (2 of 3 contexts harmed)
 * would resolve `hold`, not `adopt`.
 */
describe("CASE 11 (DISCLOSES): one context's episode volume can outvote a majority of distinct contexts", () => {
  it("1 context reporting 1,000 helped episodes plus 2 DIFFERENT contexts each reporting one harmed episode resolves adopt — despite 2 of the 3 distinct contexts actually saying harmed", () => {
    const delta = proposeDelta({
      id: "failure-case-11-delta",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.9,
      proposedAt: "2026-03-01T00:00:00Z",
    });

    const dominantContextHelped = Array.from({ length: 1000 }, (_, i) =>
      episode(delta.id, "tck-dominant", "helped", `2026-03-01T${String(9 + Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`),
    );
    const twoMinorityHarmedContexts = [
      episode(delta.id, "tck-minority-1", "harmed", "2026-03-02T00:00:00Z"),
      episode(delta.id, "tck-minority-2", "harmed", "2026-03-03T00:00:00Z"),
    ];

    const result = evaluateDelta(delta, [...dominantContextHelped, ...twoMinorityHarmedContexts], VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 3 distinct contexts total (clears MIN_DISTINCT_CONTEXTS_ADOPT), but
    // 2 of those 3 actually reported harmed — a human reading "2 of 3
    // tickets said this made things worse" would not call this a
    // helped-majority. arbitrate does, because it only sees raw counts.
    expect(result.decision.kind).toBe("adopt");
    expect(result.decision.kind === "adopt" && result.decision.tally.distinctContexts).toBe(3);
    expect(result.decision.kind === "adopt" && result.decision.tally.helped).toBe(1000);
    expect(result.decision.kind === "adopt" && result.decision.tally.harmed).toBe(2);
  });

  it("CONTROL, proving the distinct-context-level minority really would block adoption if the counts were even (one helped episode per context instead of a volume storm): the same 3 contexts, 1 episode each (1 helped, 2 harmed), correctly resolves hold, not adopt", () => {
    const delta = proposeDelta({
      id: "failure-case-11-control",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.9,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const oneEpisodeEach = [
      episode(delta.id, "tck-dominant", "helped", "2026-03-01T09:00:00Z"),
      episode(delta.id, "tck-minority-1", "harmed", "2026-03-02T00:00:00Z"),
      episode(delta.id, "tck-minority-2", "harmed", "2026-03-03T00:00:00Z"),
    ];
    const result = evaluateDelta(delta, oneEpisodeEach, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // With one episode per context, helped (1) is not a majority over
    // neutral+harmed (2) — this resolves hold, confirming the case above
    // is genuinely about VOLUME, not merely "3 contexts always adopt."
    expect(result.decision.kind).toBe("hold");
  });
});
