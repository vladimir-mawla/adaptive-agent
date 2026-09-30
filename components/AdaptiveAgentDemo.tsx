"use client";

import { useState } from "react";
import type { DomainKnobId } from "../domains/support-triage/invariants.js";
import {
  DEMO_KNOB_IDS,
  INJECTABLE_OUTCOMES,
  computeKnobView,
  type KnobView,
  type RawEpisodeInput,
} from "./compute-demo-view.js";
import type { EpisodeOutcome } from "../lib/contracts/episode.js";
import { assertNeverAdaptationDecision } from "../lib/contracts/adaptation-decision.js";

/**
 * `components/AdaptiveAgentDemo.tsx` — the one interactive page M8 owns (plan §3, M8). Renders
 * one panel per knob (`DEMO_KNOB_IDS`), a single injection form that lets a person add an
 * `Episode` with a chosen `contextId` and `outcome` against a chosen knob, and re-derives every
 * panel's `AdaptationDecision` fresh on every render from `compute-demo-view.ts`'s pure
 * `computeKnobView` — never from a value stashed in a ref or computed in an effect.
 *
 * NO `useEffect`/`useCallback`/`setTimeout`/`async` ANYWHERE IN THIS FILE: the only state this
 * component owns is `inputsByKnob` (the raw, ordered injection history per knob) and the three
 * controlled-form fields below it. Every `KnobView` is recomputed, synchronously, during this
 * render, straight from that state — see `compute-demo-view.ts`'s own header for why that is the
 * safe choice given `lib/**`'s synchronous, pure engine.
 */

const KNOB_LABELS: { readonly [K in DomainKnobId]: string } = {
  "escalation-aggressiveness": "escalation-aggressiveness (adaptable)",
  "response-directness": "response-directness (adaptable)",
  "auto-refund-ceiling": "auto-refund-ceiling (invariant-protected)",
};

type InputsByKnob = { readonly [K in DomainKnobId]: readonly RawEpisodeInput[] };

const EMPTY_INPUTS: InputsByKnob = {
  "escalation-aggressiveness": [],
  "response-directness": [],
  "auto-refund-ceiling": [],
};

function describeDecision(view: KnobView): string {
  const decision = view.decision;
  switch (decision.kind) {
    case "adopt":
      return `ADOPT — tally: ${decision.tally.distinctContexts} distinct context(s), helped=${decision.tally.helped} neutral=${decision.tally.neutral} harmed=${decision.tally.harmed}`;
    case "hold":
      return `HOLD — needs ${decision.distinctContextsNeeded} more distinct context(s); tally: ${decision.tally.distinctContexts} distinct, helped=${decision.tally.helped} neutral=${decision.tally.neutral} harmed=${decision.tally.harmed}`;
    case "revert":
      return `REVERT to ${decision.revertedTo} — tally: ${decision.tally.distinctContexts} distinct context(s), helped=${decision.tally.helped} neutral=${decision.tally.neutral} harmed=${decision.tally.harmed}`;
    case "frozen":
      return `FROZEN — invariant: ${String(decision.invariant)}`;
    default:
      return assertNeverAdaptationDecision(decision);
  }
}

function KnobPanel({ view }: { readonly view: KnobView }) {
  return (
    <section data-testid={`knob-panel-${view.knobId}`} style={{ border: "1px solid #444", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 4px" }}>{KNOB_LABELS[view.knobId]}</h2>
      <p style={{ margin: "0 0 4px" }}>
        Candidate delta <code>{view.delta.id}</code>: {view.delta.from} &rarr; {view.delta.to}
      </p>
      <p style={{ margin: "0 0 4px" }}>
        Phase: <strong>{view.phase === "live" ? "LIVE (post-adoption monitoring)" : "TRIAL (pre-adoption)"}</strong>
      </p>
      <p data-testid={`knob-decision-${view.knobId}`} style={{ margin: "0 0 4px", fontWeight: "bold" }}>
        {describeDecision(view)}
      </p>
      <p style={{ margin: "0", fontSize: "0.85em", opacity: 0.8 }}>
        {view.trialEpisodes.length} trial episode(s), {view.monitoringEpisodes.length} monitoring episode(s) injected.
      </p>
    </section>
  );
}

export function AdaptiveAgentDemo() {
  const [inputsByKnob, setInputsByKnob] = useState<InputsByKnob>(EMPTY_INPUTS);
  const [targetKnob, setTargetKnob] = useState<DomainKnobId>(DEMO_KNOB_IDS[0] ?? "escalation-aggressiveness");
  const [contextIdText, setContextIdText] = useState("");
  const [outcome, setOutcome] = useState<EpisodeOutcome>("helped");

  const views: readonly KnobView[] = DEMO_KNOB_IDS.map((knobId) => computeKnobView(knobId, inputsByKnob[knobId]));

  const canInject = contextIdText.trim().length > 0;

  function handleInject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canInject) return;
    setInputsByKnob((prev) => ({
      ...prev,
      [targetKnob]: [...prev[targetKnob], { contextId: contextIdText, outcome }],
    }));
    setContextIdText("");
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Adaptive Agent — live demo</h1>
      <p>
        Inject episodes against a knob and watch the real engine (<code>tally</code> &rarr; <code>gate</code> &rarr;{" "}
        <code>arbitrate</code>) rule on it live. The two adaptable knobs below can move from <code>hold</code> to{" "}
        <code>adopt</code> to <code>revert</code> as corroboration accumulates; <code>auto-refund-ceiling</code> is
        invariant-protected and stays <code>frozen</code> no matter how many episodes are attached to it.
      </p>

      <form onSubmit={handleInject} style={{ border: "1px solid #444", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Inject an episode</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            Target knob
            <select
              value={targetKnob}
              onChange={(event) => setTargetKnob(event.target.value as DomainKnobId)}
              style={{ display: "block", width: "100%" }}
            >
              {DEMO_KNOB_IDS.map((knobId) => (
                <option key={knobId} value={knobId}>
                  {KNOB_LABELS[knobId]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Context id (ticket id)
            <input
              type="text"
              value={contextIdText}
              onChange={(event) => setContextIdText(event.target.value)}
              placeholder="e.g. tck-1001"
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <p style={{ margin: 0, fontSize: "0.8em", opacity: 0.75 }}>
            Context ids are compared by exact string equality, never normalized: <code>&quot;tck-1&quot;</code>,{" "}
            <code>&quot;TCK-1&quot;</code>, and <code>&quot; tck-1 &quot;</code> count as three distinct contexts. Type
            the same ticket two different ways to see this honestly, rather than hidden.
          </p>
          <label>
            Outcome
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as EpisodeOutcome)}
              style={{ display: "block", width: "100%" }}
            >
              {INJECTABLE_OUTCOMES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!canInject}>
            Inject episode
          </button>
        </div>
      </form>

      {views.map((view) => (
        <KnobPanel key={view.knobId} view={view} />
      ))}
    </main>
  );
}
