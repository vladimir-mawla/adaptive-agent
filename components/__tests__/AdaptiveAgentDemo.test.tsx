import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdaptiveAgentDemo, KnobPanel, describeDecision } from "../AdaptiveAgentDemo.js";
import { computeKnobView, type RawEpisodeInput } from "../compute-demo-view.js";
import { AUTO_REFUND_CEILING_INVARIANT } from "../../domains/support-triage/invariants.js";

/**
 * `components/__tests__/AdaptiveAgentDemo.test.tsx` — the render-smoke test plan §3 (M8) names
 * explicitly: "a render-smoke test over `AdaptiveAgentDemo.tsx` via `react-dom/server`'s
 * `renderToStaticMarkup`, no jsdom." This proves the component renders to real markup, on a
 * plain Node environment, with zero DOM emulation — `vitest.config.ts`'s own `environment:
 * "node"` is untouched by this file. A real browser's interactivity (clicking "Inject episode",
 * watching state update) is exercised separately, live, against `npm run dev` — see this
 * milestone's own PR report for that session's transcript; that verification cannot run inside
 * a static server-render, which has no event loop for a click to run on.
 */
describe("AdaptiveAgentDemo render smoke test", () => {
  it("renders to static markup with no jsdom, containing all three knob panels and their initial decisions", () => {
    const markup = renderToStaticMarkup(<AdaptiveAgentDemo />);

    expect(markup).toContain("escalation-aggressiveness");
    expect(markup).toContain("response-directness");
    expect(markup).toContain("auto-refund-ceiling");

    // Zero episodes injected yet: the two adaptable knobs must read HOLD, and the
    // invariant-protected knob must read FROZEN — never ADOPT/REVERT with no evidence at all.
    expect(markup).toContain("HOLD");
    expect(markup).toContain("FROZEN");
    expect(markup).not.toContain("REVERT to");

    // The injection form itself is present.
    expect(markup).toContain("Inject an episode");
    expect(markup).toContain("Inject episode");
  });

  it("never renders ADOPT or REVERT for auto-refund-ceiling's own panel text, at initial render", () => {
    const markup = renderToStaticMarkup(<AdaptiveAgentDemo />);
    const panelStart = markup.indexOf('data-testid="knob-panel-auto-refund-ceiling"');
    const nextPanelStart = markup.indexOf('data-testid="knob-panel-', panelStart + 1);
    const panelMarkup = markup.slice(panelStart, nextPanelStart === -1 ? undefined : nextPanelStart);
    expect(panelMarkup).toContain("FROZEN");
    expect(panelMarkup).not.toContain("ADOPT");
    expect(panelMarkup).not.toContain("REVERT");
  });
});

function helped(id: string): RawEpisodeInput {
  return { contextId: id, outcome: "helped" };
}
function neutral(id: string): RawEpisodeInput {
  return { contextId: id, outcome: "neutral" };
}
function harmed(id: string): RawEpisodeInput {
  return { contextId: id, outcome: "harmed" };
}

/**
 * THE RENDERED TEXT IS PINNED AGAINST REAL ENGINE DECISIONS. The static-markup smoke test above can
 * only ever render the zero-episode initial state (it has no event loop for a click to run on), so
 * on its own it could not tell a panel that renders the engine's decision from one that prints a
 * canned string — L4 VERIFY's mutant that hardcoded `"HOLD — hardcoded"` / `"FROZEN — invariant:
 * hardcoded"` passed the whole suite. Every `view` below comes from a real `computeKnobView` call
 * (the real tally -> gate -> arbitrate chain), and every expected string is a LITERAL with the
 * specific numbers that history must produce — never rebuilt from the same template under test —
 * so a renderer that ignores the decision, or reads the wrong field of it, cannot pass.
 */
describe("describeDecision renders the real engine decision's own values", () => {
  it("hold: the real distinctContextsNeeded and all three counts (1 helped episode)", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1")]);
    expect(describeDecision(view)).toBe("HOLD — needs 2 more distinct context(s); tally: 1 distinct, helped=1 neutral=0 harmed=0");
  });

  it("hold with distinctContextsNeeded 0 and neutral counted: 3 distinct neutral episodes", () => {
    const view = computeKnobView("escalation-aggressiveness", [neutral("tck-1"), neutral("tck-2"), neutral("tck-3")]);
    expect(describeDecision(view)).toBe("HOLD — needs 0 more distinct context(s); tally: 3 distinct, helped=0 neutral=3 harmed=0");
  });

  it("adopt: the trial pool's real tally, including a neutral episode (2 helped + 1 neutral)", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1"), helped("tck-2"), neutral("tck-3")]);
    expect(describeDecision(view)).toBe("ADOPT — tally: 3 distinct context(s), helped=2 neutral=1 harmed=0");
  });

  it("revert: rolls back to THIS knob's own delta.from — 0.5 for escalation-aggressiveness", () => {
    const view = computeKnobView("escalation-aggressiveness", [
      helped("tck-1"),
      helped("tck-2"),
      helped("tck-3"),
      harmed("tck-4"),
      harmed("tck-5"),
    ]);
    expect(describeDecision(view)).toBe("REVERT to 0.5 — tally: 2 distinct context(s), helped=0 neutral=0 harmed=2");
  });

  it("revert: ... and 0.4 for response-directness, so the rolled-back value is read off the decision, not hardcoded", () => {
    const view = computeKnobView("response-directness", [
      helped("tck-1"),
      helped("tck-2"),
      helped("tck-3"),
      harmed("tck-4"),
      harmed("tck-5"),
      harmed("tck-6"),
    ]);
    expect(describeDecision(view)).toBe("REVERT to 0.4 — tally: 3 distinct context(s), helped=0 neutral=0 harmed=3");
  });

  it("frozen: cites this domain's own invariant id, and no tally at all", () => {
    const view = computeKnobView("auto-refund-ceiling", [helped("tck-1"), helped("tck-2"), helped("tck-3")]);
    expect(describeDecision(view)).toBe("FROZEN — invariant: inv-auto-refund-ceiling");
    expect(describeDecision(view)).toBe(`FROZEN — invariant: ${AUTO_REFUND_CEILING_INVARIANT.id}`);
  });
});

describe("KnobPanel renders a real mid-story view end to end", () => {
  it("escalation-aggressiveness after 3 distinct helped episodes: LIVE, ADOPT with the real tally, and real episode counts", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1"), helped("tck-2"), helped("tck-3")]);
    const markup = renderToStaticMarkup(<KnobPanel view={view} />);
    expect(markup).toContain("escalation-aggressiveness (adaptable)");
    expect(markup).toContain("LIVE (post-adoption monitoring)");
    expect(markup).toContain("ADOPT — tally: 3 distinct context(s), helped=3 neutral=0 harmed=0");
    expect(markup).toContain("3 trial episode(s), 0 monitoring episode(s) injected.");
    expect(markup).not.toContain("TRIAL (pre-adoption)");
  });

  it("escalation-aggressiveness after 3 helped + 2 harmed: LIVE, REVERT to 0.5 with the real monitoring tally, and real episode counts", () => {
    const view = computeKnobView("escalation-aggressiveness", [
      helped("tck-1"),
      helped("tck-2"),
      helped("tck-3"),
      harmed("tck-4"),
      harmed("tck-5"),
    ]);
    const markup = renderToStaticMarkup(<KnobPanel view={view} />);
    expect(markup).toContain("LIVE (post-adoption monitoring)");
    expect(markup).toContain("REVERT to 0.5 — tally: 2 distinct context(s), helped=0 neutral=0 harmed=2");
    expect(markup).toContain("3 trial episode(s), 2 monitoring episode(s) injected.");
  });

  it("escalation-aggressiveness after 1 helped episode: TRIAL, HOLD with the real shortfall, and real episode counts", () => {
    const view = computeKnobView("escalation-aggressiveness", [helped("tck-1")]);
    const markup = renderToStaticMarkup(<KnobPanel view={view} />);
    expect(markup).toContain("TRIAL (pre-adoption)");
    expect(markup).toContain("HOLD — needs 2 more distinct context(s); tally: 1 distinct, helped=1 neutral=0 harmed=0");
    expect(markup).toContain("1 trial episode(s), 0 monitoring episode(s) injected.");
    expect(markup).not.toContain("LIVE (post-adoption monitoring)");
  });

  it("auto-refund-ceiling after 3 distinct helped episodes (the evidence that adopts the other knob): still TRIAL and FROZEN, never ADOPT/HOLD/REVERT, with the 3 episodes counted", () => {
    const view = computeKnobView("auto-refund-ceiling", [helped("tck-1"), helped("tck-2"), helped("tck-3")]);
    const markup = renderToStaticMarkup(<KnobPanel view={view} />);
    expect(markup).toContain("auto-refund-ceiling (invariant-protected)");
    expect(markup).toContain("TRIAL (pre-adoption)");
    expect(markup).toContain("FROZEN — invariant: inv-auto-refund-ceiling");
    expect(markup).toContain("3 trial episode(s), 0 monitoring episode(s) injected.");
    expect(markup).not.toContain("ADOPT");
    expect(markup).not.toContain("HOLD");
    expect(markup).not.toContain("REVERT");
    expect(markup).not.toContain("LIVE (post-adoption monitoring)");
  });
});
