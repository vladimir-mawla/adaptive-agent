import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { distinctContextEpisodes, episode, liveState, sameContextStorm } from "./helpers.js";

/**
 * ============================================================
 * CASE 3 — REVERT OFF A SINGLE POST-ADOPTION INCIDENT (`.genesis/PLAN.md`
 * §4, case 3)
 * ============================================================
 * KIND: PROVES A REFUSAL HOLDS.
 *
 * THE CLAIM PINNED: one `"harmed"` episode after adoption must yield
 * continued `adopt`, not `revert` — the revert bar
 * (`MIN_DISTINCT_CONTEXTS_REVERT = 2`) is lower than the adopt bar
 * (`= 3`), the deliberate asymmetry plan §1 names, but it is not zero.
 * Traces to M5's asymmetric-bar refusal (`lib/arbitrate/arbitrate.ts`'s
 * `clearsRevertBar`). `domains/support-triage/__tests__/scenario.test.ts`
 * already proves this at n=1 for `escalation-aggressiveness` alone; this
 * case extends it two ways that file does not cover: a same-context
 * REPLAY STORM of harmed episodes post-adoption (proving the refusal is
 * not merely "one episode is not enough" but "one CONTEXT is not enough,
 * regardless of episode count"), and the same shape on
 * `response-directness`, this domain's other adaptable knob, so a
 * regression narrow enough to break only one knob's own code path has
 * nowhere to hide.
 *
 * WHAT WOULD MAKE THIS FAIL: `MIN_DISTINCT_CONTEXTS_REVERT` being lowered
 * to 1, or `clearsRevertBar` reading episode count instead of
 * `distinctContexts`. Proven for real below.
 */
describe("CASE 3 (PROVES): a single post-adoption incident — even repeated many times from one context — never reverts alone", () => {
  it("one post-adoption harmed episode on response-directness resolves continued adopt, not revert", () => {
    const delta = proposeDelta({
      id: "failure-case-3-delta-a",
      knob: "response-directness",
      from: 0.5,
      to: 0.2,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const live = liveState(delta.id, delta.from);
    const result = evaluateDelta(delta, [episode(delta.id, "tck-harm-1", "harmed", "2026-03-02T00:00:00Z")], live);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
  });

  it("a 5,000-episode same-context harmed REPLAY STORM post-adoption still resolves continued adopt — one context is not enough no matter how many times it repeats", () => {
    const delta = proposeDelta({
      id: "failure-case-3-delta-b",
      knob: "escalation-aggressiveness",
      from: 0.6,
      to: 0.9,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const live = liveState(delta.id, delta.from);
    const storm = sameContextStorm(delta.id, "tck-harm-storm", "harmed", 5000);
    const result = evaluateDelta(delta, storm, live);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
    expect(result.decision.kind === "adopt" && result.decision.tally.distinctContexts).toBe(1);
    expect(result.decision.kind === "adopt" && result.decision.tally.harmed).toBe(5000);
  });

  it("CONTROL, proving the bar is real and not merely 'always adopt continues': 2 genuinely distinct harmed contexts (MIN_DISTINCT_CONTEXTS_REVERT) DOES revert", () => {
    const delta = proposeDelta({
      id: "failure-case-3-control",
      knob: "escalation-aggressiveness",
      from: 0.6,
      to: 0.9,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const live = liveState(delta.id, delta.from);
    const twoDistinct = distinctContextEpisodes(delta.id, "tck-harm-real", "harmed", 2);
    const result = evaluateDelta(delta, twoDistinct, live);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("revert");
    expect(result.decision.kind === "revert" && result.decision.revertedTo).toBe(0.6);
  });
});
