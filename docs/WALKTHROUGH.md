# WALKTHROUGH — a ~80-second Loom script for M8's interactive demo

Read this aloud, performing each bracketed action at that point in the script.

**Verification status, corrected for M9.** This script was written and first verified against
`http://localhost:3000` (`npm run dev`), because when M8 was built the Vercel CLI was logged out and
`https://adaptive-agent-gamma.vercel.app` still served the pre-M8 build. **That is no longer true.** For M9
the whole sequence below was driven in a browser against the deployed URL on 2026-10-23, twice: once while
`/api/health` reported `44e42b494ccc711e199c190c96cc91054a6a99d5`, and once while it reported
`2879c13f3465ef2d8dd6cff502cae15b175b6852`. Each state read back from the deployed page matched the
corresponding step under "Verification" below; `docs/NOTES.md` records the times and the readings. The
localhost verification that follows is kept as it was written.

## What the last beat has to prove, and why it injects three episodes, not one

The claim this project exists to make is not "an episode against `auto-refund-ceiling` shows
`frozen`" — one `helped` episode leaves the *ordinary* knob on `HOLD` too, so a single injection
makes both knobs look equally inert and teaches a viewer nothing about the protected one. The claim
is that `frozen` is immune to **evidence that would have adopted**. So the final beat re-injects the
**exact same three distinct-context `helped` tickets** (`tck-4471`, `tck-5002`, `tck-5108`) that
adopted `escalation-aggressiveness` in the second beat, this time against `auto-refund-ceiling`,
and shows it does not move. The ticket ids are distinct (so what is on screen is not a same-context
replay storm), and the panel's own `N trial episode(s)` counter ticks `1`, `2`,
`3` as each is accepted while the ruling stays `FROZEN` — the episodes are counted and visibly
ignored, not dropped. (Each knob keeps its own episode log, so reusing the same three ticket ids on a
second knob is legitimate: they are three distinct contexts *within that knob's own delta*.) This is
the same contrast `npm run demo:triage` makes at its steps 8–9.

## Timing

- Pure narration (106 words) at a natural, deliberate 150-words-per-minute presenter pace,
  synthesized with macOS `say -r 150` and measured with `afinfo`: **47.4 seconds** on the machine
  this script was written on. Matching the sibling precedent's own disclosed caveat: `say`'s actual
  output rate depends on the system voice and OS build, not just the `-r` argument (a sibling's own
  independent re-measurement of the same script differed by roughly 8%), so this figure is a
  rig-dependent estimate, not a portable constant.
- **Eleven** on-screen actions: eight injections (three `helped` + one `harmed` + one `harmed` +
  three `helped`, each a click into the context-id field, typing a ticket id, and clicking Inject)
  plus three dropdown changes (Outcome to `harmed`; Target knob to `auto-refund-ceiling`; Outcome back
  to `helped`). Each needs a moment to move the cursor, type, and let the panel visibly update before
  continuing to speak: estimated **~2–4 seconds each, ~22–44 seconds total (central ~33)** — an
  estimate, not a measurement of an actual recording. (An earlier revision of this file counted "six
  on-screen actions" and budgeted ~18 seconds; that undercounted — the same flow already had six
  injections and three dropdown changes, i.e. nine actions. The count above is the correct one.)
- **Honest estimate, additive model: roughly 65–95 seconds, central estimate ~80 seconds.** The
  additive model is conservative — a presenter naturally types while talking, so real overlap should
  pull a recording toward the low end — but that overlap is **not measured**, and the pessimistic
  corner (slowest narration *and* slowest actions) lands slightly past the ~90s target the plan sets
  for this milestone's headline moment. Narration was trimmed from the previous revision's 133 words
  (55.3s) to 106 words (47.4s) specifically to absorb the three extra injections rather than dropping
  the beat back to a single episode. If a recording runs long, the first thing to cut is the
  "tally, gate, arbitrate" half of the opening sentence — not the three-episode beat.
- **Deliberately scoped to eight injections:** the `response-directness` contextId-spelling-drift
  story (`"tck-9001"`/`"TCK-9001"`/`" tck-9001 "`) is real, live, and covered by
  `components/__tests__/compute-demo-view.test.ts` and by a separate, untimed manual browser session
  (see this milestone's PR report), but adding it here would push a 90-second target past its budget
  for a secondary point the headline moment does not require.

## The script

> This is Adaptive Agent, live, not a recording. The rulings and tallies here are real engine
> calls: tally, gate, arbitrate.
>
> At zero episodes, escalation-aggressiveness reads hold, and auto-refund-ceiling already reads
> frozen.
>
> **[Inject a helped episode, context `tck-4471`, against escalation-aggressiveness. Repeat for
> `tck-5002`, then `tck-5108`.]**
>
> Three distinct helped tickets against escalation-aggressiveness: hold, hold, adopt. Live at 0.8.
>
> **[Switch Outcome to harmed. Inject context `tck-6210`, then `tck-6355`.]**
>
> Now harmed tickets. One isn't enough; still adopt. A second, distinct one clears the lower revert
> bar: revert, back to 0.5.
>
> **[Switch Target knob to auto-refund-ceiling and Outcome back to helped. Inject `tck-4471`, then
> `tck-5002`, then `tck-5108` — the same three tickets that just adopted the other knob.]**
>
> Now the exact same three helped tickets, against auto-refund-ceiling. The evidence that just
> adopted the other knob moves this one not at all. Still frozen, still in trial.
>
> Evidence earns adoption by diversity, not volume, and one knob no evidence can touch.

## Verification (beat by beat, against `localhost:3000`, not against intentions)

Each step below was performed against a real `npm run dev` session, started fresh (zero episodes on
every knob), driven with real clicks and typing into the rendered form — the exact text quoted is
what the page actually rendered at that step, read back from the page (via this session's browser
tooling), not written first and checked second. This is a re-verification of the whole sequence,
including the rewritten final beat, performed when this revision was written; the page's console
reported no errors throughout.

1. **Fresh load (zero episodes).** `escalation-aggressiveness` panel: `Phase: TRIAL (pre-adoption)`,
   `HOLD — needs 3 more distinct context(s); tally: 0 distinct, helped=0 neutral=0 harmed=0`.
   `auto-refund-ceiling` panel: `Phase: TRIAL (pre-adoption)`, `FROZEN — invariant:
   inv-auto-refund-ceiling`, `0 trial episode(s), 0 monitoring episode(s) injected.`
2. **After injecting `tck-4471`, `tck-5002`, `tck-5108` (all `helped`) against
   escalation-aggressiveness.** `Phase: LIVE (post-adoption monitoring)`, `ADOPT — tally: 3 distinct
   context(s), helped=3 neutral=0 harmed=0`, `3 trial episode(s), 0 monitoring episode(s) injected.`
   The other two panels were unchanged (`response-directness` still `HOLD`, `auto-refund-ceiling`
   still `FROZEN`, `0 trial episode(s)`).
3. **After switching Outcome to `harmed` and injecting `tck-6210`.** Still `Phase: LIVE
   (post-adoption monitoring)`, `ADOPT — tally: 1 distinct context(s), helped=0 neutral=0
   harmed=1` — one post-adoption harmed episode is not enough to revert.
4. **After injecting a second, distinct `harmed` episode, `tck-6355`.** `Phase: LIVE
   (post-adoption monitoring)`, `REVERT to 0.5 — tally: 2 distinct context(s), helped=0 neutral=0
   harmed=2`, `3 trial episode(s), 2 monitoring episode(s) injected.`
5. **After switching Target knob to `auto-refund-ceiling` and Outcome back to `helped`, then
   injecting `tck-4471`, `tck-5002`, `tck-5108` — the identical three tickets, identical outcome, that
   produced step 2's `ADOPT` on the other knob.** The `auto-refund-ceiling` panel, read back after
   *each* injection, rendered `Phase: TRIAL (pre-adoption)`, `FROZEN — invariant:
   inv-auto-refund-ceiling` every time, with the episode counter reading `1 trial episode(s), 0
   monitoring episode(s) injected.`, then `2 trial episode(s), ...`, then `3 trial episode(s), 0
   monitoring episode(s) injected.` — the episodes were accepted and counted, the ruling did not
   change across the three reads, and the knob stayed in `TRIAL`. The final state of all three panels read together:
   `escalation-aggressiveness` `REVERT to 0.5 — tally: 2 distinct context(s), helped=0 neutral=0
   harmed=2`; `response-directness` `HOLD — needs 3 more distinct context(s); tally: 0 distinct,
   helped=0 neutral=0 harmed=0`; `auto-refund-ceiling` `FROZEN — invariant: inv-auto-refund-ceiling`,
   `3 trial episode(s), 0 monitoring episode(s) injected.`

## Not shown in this timed script, but real and verified separately

The contextId-spelling-drift story — `response-directness` evaluated against `"tck-9001"`,
`"TCK-9001"`, and `" tck-9001 "` (one real ticket, typed three ways) — was also driven live against
`localhost:3000` in the earlier M8 build session (see this milestone's PR report for the full
transcript): the panel read `Phase: LIVE (post-adoption monitoring)`, `ADOPT — tally: 3 distinct
context(s), helped=3 neutral=0 harmed=0`. This is the identical, disclosed `contextId`-identity limit
`domains/support-triage/scenario.ts` and `tests/failures/06-context-id-spelling-drift.test.ts`
already pin — exercised honestly in this UI (the help text next to the context-id field names it
directly), not hidden and not normalized away. It was not re-driven in this revision's session, which
changed only the final beat of the timed script. For M9 it was also driven on the deployed URL
(2026-10-23): `response-directness` read `ADOPT — tally: 3 distinct context(s), helped=3 neutral=0 harmed=0`
after `tck-9001`, `TCK-9001` and ` tck-9001 `, and the same ticket typed identically three times on
`escalation-aggressiveness` read `HOLD — needs 2 more distinct context(s); tally: 1 distinct, helped=3 neutral=0
harmed=0`.
