import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdaptiveAgentDemo } from "../AdaptiveAgentDemo.js";

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
