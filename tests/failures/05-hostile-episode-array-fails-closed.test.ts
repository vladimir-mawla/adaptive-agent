import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { episode, VACANT } from "./helpers.js";
import type { Episode } from "../../lib/contracts/episode.js";

/**
 * ============================================================
 * CASE 5 — HOSTILE EPISODE ARRAY (`.genesis/PLAN.md` §4, case 5)
 * ============================================================
 * KIND: PROVES A REFUSAL HOLDS.
 *
 * THE CLAIM PINNED: a `Proxy` that throws on every property access, or a
 * getter that throws on `.outcome`, fed anywhere into this system's real
 * entry point must produce a typed failure — not an uncaught exception.
 * Traces to M3's `lib/evidence/tally.ts` (`lib/evidence/__tests__/
 * hostile-input.test.ts` already proves this at `tally()`'s own call
 * boundary). This case re-proves it one layer further OUT — through
 * `domains/support-triage/scenario.ts`'s `evaluateDelta`, this system's
 * actual composition point — confirming the fail-closed discipline
 * propagates all the way to the domain's own public `DecisionResult`
 * rather than being an internal detail `lib/evidence` alone honors.
 *
 * WHAT WOULD MAKE THIS FAIL: `evaluateDelta` (or `tally` underneath it)
 * losing its `try`/`catch` around episode field access, or `evaluateDelta`
 * re-throwing `tally`'s own typed failure instead of folding it into
 * `DecisionResult.ok: false`. Proven for real below.
 */
describe("CASE 5 (PROVES): a hostile episodes array reaching the real entry point fails closed, never an uncaught exception", () => {
  it("a Proxy that throws on every property access, passed straight into evaluateDelta, yields a typed { ok: false }, not a thrown error", () => {
    const delta = proposeDelta({
      id: "failure-case-5-delta-a",
      knob: "escalation-aggressiveness",
      from: 0.4,
      to: 0.8,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const hostileArray = new Proxy([] as readonly Episode[], {
      get() {
        throw new Error("hostile Proxy trap");
      },
    });

    let threw = false;
    let result: ReturnType<typeof evaluateDelta> | undefined;
    try {
      result = evaluateDelta(delta, hostileArray, VACANT);
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result).toBeDefined();
    expect(result?.ok).toBe(false);
    expect(result !== undefined && !result.ok && result.reason).toMatch(/hostile-episodes-input/);
  });

  it("a getter that throws on .outcome, on an otherwise-ordinary single-element array, also yields a typed failure, not a crash", () => {
    const delta = proposeDelta({
      id: "failure-case-5-delta-b",
      knob: "response-directness",
      from: 0.4,
      to: 0.6,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const hostileEpisode = {
      deltaId: delta.id,
      contextId: "tck-hostile-1",
      get outcome(): never {
        throw new Error("hostile getter: outcome");
      },
      observedAt: "2026-03-02T00:00:00Z",
    } as unknown as Episode;

    let threw = false;
    let result: ReturnType<typeof evaluateDelta> | undefined;
    try {
      result = evaluateDelta(delta, [hostileEpisode], VACANT);
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result?.ok).toBe(false);
  });

  it("CONTROL, proving the failure is genuinely caused by the hostile input, not a general inability of evaluateDelta to succeed: an ordinary, well-formed single episode resolves normally, no failure", () => {
    const delta = proposeDelta({
      id: "failure-case-5-control",
      knob: "response-directness",
      from: 0.4,
      to: 0.6,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const ordinary = episode(delta.id, "tck-ordinary-1", "helped", "2026-03-02T00:00:00Z");
    const result = evaluateDelta(delta, [ordinary], VACANT);
    expect(result.ok).toBe(true);
  });
});
