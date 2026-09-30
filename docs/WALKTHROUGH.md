# WALKTHROUGH — a ~75-second Loom script for M8's interactive demo

Read this aloud, performing each bracketed action at that point in the script.

**IMPORTANT, READ FIRST: verified against `http://localhost:3000` (`npm run dev`), NOT against the
deployed URL.** At the time this milestone (M8) was built, the Vercel CLI on this machine was
logged out and `VERCEL_TOKEN` was not in the environment (the token was being rotated) — deploying
was explicitly out of scope for this round. `https://adaptive-agent-gamma.vercel.app` still serves
the pre-M8 build (M7) and has **not** been updated with this milestone's UI. Every line of narration
below was checked against a real, running `next dev --webpack` session on this machine instead —
this is a transcript of an actual click-through of `localhost:3000`, re-read as narration, not a
script written against intentions. Re-verify against the deployed URL once it is redeployed with
this milestone's changes (a later session's job, not this one's — see this milestone's own PR/report
for why deploying was refused here).

## Timing

- Pure narration (133 words) at a natural, deliberate 150-words-per-minute presenter pace,
  synthesized with macOS `say -r 150` and measured with `afinfo`: **55.3 seconds** on the machine
  this script was written on. Matching the sibling precedent's own disclosed caveat: `say`'s actual
  output rate depends on the system voice and OS build, not just the `-r` argument, so this figure is
  a rig-dependent estimate, not a portable constant.
- Six on-screen actions (four text-field entries + submits on the same target, one dropdown switch
  to `harmed`, one dropdown switch to `auto-refund-ceiling` + back to `helped`), each needing a
  moment to move the cursor, type a ticket id, and let the panel visibly update before continuing to
  speak: estimated **~3 seconds each, ~18 seconds total** — an estimate, not a measurement of an
  actual recording.
- **Honest estimate: roughly 70–80 seconds**, depending on the voice/OS synthesizing (or the actual
  presenter's own) pace, plus interaction time — comfortably under the ~90s target the plan sets for
  this milestone's headline moment. Don't be surprised if an actual recording lands a little
  differently; that is expected variance, not a sign of rushing.
- **Deliberately scoped to six injections, not all thirteen this milestone's own test suite
  exercises:** the plan's own M8 falsifiable check says auto-refund-ceiling must show `frozen` "from
  the first injection, never moving regardless of how many episodes are added" — one injection
  against it is enough to prove that claim on camera; the response-directness
  contextId-spelling-drift story (`"tck-9001"`/`"TCK-9001"`/`" tck-9001 "`) is real, live, and
  covered by `components/__tests__/compute-demo-view.test.ts` and by a separate, untimed manual
  browser session (see this milestone's PR report), but adding it here would push a 90-second target
  past its budget for a secondary point the headline moment does not require.

## The script

> This is Adaptive Agent, running live on my own machine right now, not a recording. Every value
> here is a real function call: tally, then gate, then arbitrate.
>
> At zero episodes, escalation-aggressiveness reads hold, and the invariant-protected
> auto-refund-ceiling already reads frozen.
>
> **[Inject a helped episode, context `tck-4471`, against escalation-aggressiveness. Repeat for
> `tck-5002`, then `tck-5108`.]**
>
> I inject three distinct helped tickets against escalation-aggressiveness. Hold, hold, then adopt
> — the knob goes live at 0.8.
>
> **[Switch Outcome to harmed. Inject context `tck-6210`.]**
>
> Now two distinct harmed tickets. One alone isn't enough; adopt continues.
>
> **[Inject a second harmed episode, context `tck-6355`.]**
>
> A second, distinct harmed ticket clears the lower revert bar: revert, back to 0.5.
>
> **[Switch Target knob to auto-refund-ceiling, Outcome back to helped. Inject context `tck-7001`.]**
>
> One more injection — a helped ticket against auto-refund-ceiling, the exact evidence that just
> adopted the other knob. Still frozen. No amount of evidence ever reaches this ruling at all.
>
> That's the claim: evidence earns adoption by diversity, not volume, and one knob no evidence can
> ever touch.

## Verification (beat by beat, against `localhost:3000`, not against intentions)

Each step below was performed against a real `npm run dev` session, started fresh (zero episodes on
every knob), immediately before this file was written — the exact text quoted is what the page
actually rendered at that step, copied from the page (via this session's browser tooling), not
written first and checked second.

1. **Fresh load (zero episodes).** `escalation-aggressiveness` panel: `Phase: TRIAL (pre-adoption)`,
   `HOLD — needs 3 more distinct context(s); tally: 0 distinct, helped=0 neutral=0 harmed=0`.
   `auto-refund-ceiling` panel: `Phase: TRIAL (pre-adoption)`, `FROZEN — invariant:
   inv-auto-refund-ceiling`.
2. **After injecting `tck-4471`, `tck-5002`, `tck-5108` (all `helped`) against
   escalation-aggressiveness.** `Phase: LIVE (post-adoption monitoring)`, `ADOPT — tally: 3 distinct
   context(s), helped=3 neutral=0 harmed=0`, `3 trial episode(s), 0 monitoring episode(s) injected.`
3. **After injecting one `harmed` episode, context `tck-6210`.** Still `Phase: LIVE (post-adoption
   monitoring)`, `ADOPT — tally: 1 distinct context(s), helped=0 neutral=0 harmed=1`, `3 trial
   episode(s), 1 monitoring episode(s) injected.` — one post-adoption harmed episode is not enough
   to revert.
4. **After injecting a second, distinct `harmed` episode, context `tck-6355`.** `Phase: LIVE
   (post-adoption monitoring)`, `REVERT to 0.5 — tally: 2 distinct context(s), helped=0 neutral=0
   harmed=2`, `3 trial episode(s), 2 monitoring episode(s) injected.`
5. **After switching Target knob to `auto-refund-ceiling`, Outcome to `helped`, and injecting one
   episode, context `tck-7001` — the identical evidence shape (a single helped episode) as step 2's
   first injection, which began escalation-aggressiveness's own path to adopt.** `Phase: TRIAL
   (pre-adoption)` (never left trial at all), `FROZEN — invariant: inv-auto-refund-ceiling`, `1 trial
   episode(s), 0 monitoring episode(s) injected.` — byte-for-byte the same ruling as step 1's zero-episode
   state, evidence or none.

## Not shown in this timed script, but real and verified separately

The contextId-spelling-drift story — `response-directness` evaluated against `"tck-9001"`,
`"TCK-9001"`, and `" tck-9001 "` (one real ticket, typed three ways) — was also driven live against
`localhost:3000` in the same session (see this milestone's PR report for the full transcript): the
panel read `Phase: LIVE (post-adoption monitoring)`, `ADOPT — tally: 3 distinct context(s),
helped=3 neutral=0 harmed=0`. This is the identical, disclosed `contextId`-identity limit
`domains/support-triage/scenario.ts` and `tests/failures/06-context-id-spelling-drift.test.ts`
already pin — exercised honestly in this UI (the help text next to the context-id field names it
directly), not hidden and not normalized away.
