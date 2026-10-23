# Adaptive Agent

Whether an agent's proposed change to its own future behavior has earned the right to stick, based
on independent, diverse evidence rather than one loud incident.

**Live:** <https://adaptive-agent-gamma.vercel.app> — a page where you inject episodes and watch the real
engine rule on them. `GET /api/health` runs a self-check of one function, `assertFrozenCitesNoEvidence`, not of `tally`, `gate` or `arbitrate`, and reports the deployed commit. All times in this
document are UTC.

## What this is

A candidate change to one behavior knob (a `BehaviorDelta`) and a stream of evidence about it (`Episode`s,
each with a `contextId` and an outcome of `helped`, `neutral` or `harmed`) pass through three stages —
`tally` → `gate` → `arbitrate` — and come out, for well-formed input, as exactly one of four decisions:

| Decision | Meaning | When |
|---|---|---|
| `adopt` | the change sticks | for a not-yet-adopted change, at least 3 distinct `contextId`s and more `helped` episodes than `neutral` + `harmed`; an adopted change stays `adopt` until the revert bar is met |
| `hold` | not yet; carries a `distinctContextsNeeded` count, which is the real shortfall only when too few contexts is the blocker (Limits, item 20) | evidence short of that bar, or a different change is already live on the knob |
| `revert` | an adopted change is rolled back to the value it replaced | at least 2 distinct post-adoption contexts, and more `harmed` episodes than `helped` + `neutral` |
| `frozen` | refused outright | the knob is named by an `Invariant`; neither `gate` nor `arbitrate`'s frozen branch consults the evidence's counts |

The refusal this exists to make: one ticket complained about 500 times is one occasion
(`distinctContexts: 1`), not 500, because corroboration is counted by distinct `contextId`, not by
episode count. The adopt bar (3) is higher than the revert bar (2) on purpose. `docs/ARCHITECTURE.md`
walks each stage and cites a test for every refusal except one, which it marks; `docs/THESIS.md` says what a reader should disagree
with.

**What it is not.** There is no agent in this repository. The "support-triage agent" is three knobs, one
invariant (`auto-refund-ceiling`), a scenario, and `evaluateDelta`, the function that composes the three
stages. Decisions are returned, never applied: the only callers of `evaluateDelta` are
`scripts/demo-triage.ts`, the demo page's view-model, and tests. The thresholds 3 and 2 are invented policy
constants (`lib/arbitrate/policy-constants.ts` says so), and every episode in the repository is synthetic.

## Try it

- Open the live page and follow `docs/WALKTHROUGH.md` (estimated at about 80 seconds). Three helped tickets move
  `escalation-aggressiveness` from `hold` to `adopt`; two harmed ones revert it; the same three helped tickets
  against `auto-refund-ceiling` leave it `frozen`.
- `curl -s https://adaptive-agent-gamma.vercel.app/api/health` returns JSON with `"status":"ok"` and the
  deployed commit.
- The page keeps its state in the browser tab only; reloading returns every panel to zero episodes.

## Run it

```bash
npm ci
npm run typecheck
npm test
npm run demo:triage
npm run dev
npm run build
npm run lint
```

- **`npm ci`, never `npm install`.** `engines` pins Node 24.x; this was run on Node v24.7.0 and npm 11.5.1.
  `.genesis/PLAN.md` §5 records the reason for the rule — an npm 11.5.1 behavior in which `install` against an
  existing lockfile can drop Vitest's platform-specific binding — and it was not re-tested here.
- `npm run typecheck` runs `tsc` against `tsconfig.lib.json` (`lib/`, `domains/`, `scripts/`, `tests/`) and
  `tsconfig.json` (`app/`, `components/`). **It is half of the check:** the `TYPE-LEVEL` tests are
  `@ts-expect-error` lines that only `tsc` enforces. Run it as well as `npm test`.
- `npm test` is `vitest run`: 44 files, 384 tests, a few seconds. Two 10,000-episode tests take 2 to 3
  seconds each on their own (see Limits, item 17).
- `npm run demo:triage` prints nine steps — `hold` three times, `adopt`, `adopt`, `revert`, `adopt` for one
  ticket spelled three ways, then `frozen` twice — and exits 0 only if all four decision kinds were observed.
  No test runs it.
- `npm run dev` serves the page on <http://localhost:3000>; `npm run build` makes a production build. Both pass
  `--webpack` (see `next.config.ts` for why Turbopack is not used).
- `npm run lint` is `eslint .` and **does not read any TypeScript** (see Limits, item 8).

## Where things are

| Path | What |
|---|---|
| `lib/contracts/` | the closed vocabulary: `Episode`, `BehaviorDelta`, `Invariant`, `EvidenceTally`, `AdaptationDecision` |
| `lib/evidence/` | `tally` — counts distinct contexts |
| `lib/invariants/` | `gate` and the frozen `InvariantRegistry` |
| `lib/arbitrate/` | `arbitrate` and its two policy constants |
| `domains/support-triage/` | the three knobs, the one invariant, `evaluateDelta`, fixtures |
| `tests/failures/` | the 17-case failure suite (`npm test -- failures`: 17 files, 45 tests) |
| `scripts/` | `demo-triage.ts` and the Node loader hooks it runs under |
| `components/`, `app/` | the demo page, its view-model, and `/api/health` |
| `docs/` | `ARCHITECTURE.md`, `THESIS.md`, `NOTES.md`, `WALKTHROUGH.md` |
| `.genesis/` | the plan, the locked definition of done, the checkpoint, and eight ADRs (`decisions/0001` to `0008`) |

## Limits

Each limit below was reproduced or re-read for this document, and names the test, command or file behind it, or says that none exists.
`npm test -- failures` runs the 17-case failure suite: five cases prove a refusal holds, ten disclose a gap,
one is mixed (13) and one pins three textual facts (16). **"Probe"** means the block under "Limits probe" in
`docs/NOTES.md`, run from the repository root; **"scratch clone"** means a throwaway clone of `main` at
`44e42b4` that was edited and then discarded (`2879c13` differs from it only in `package.json` and
`package-lock.json`). Nothing in a scratch clone was committed.

**1. `contextId` spelling drift.** `tally` counts distinct contexts by exact string equality, and
`contextId()` is `raw as ContextId`: nothing trims, folds case, strips zero-width characters or normalizes
Unicode. Case, whitespace, a zero-width space (U+200B) and NFC versus NFD each make a distinct id, so **one
real ticket written three ways clears the three-context adopt bar with no second occasion** — no attacker
needed, one inconsistent integration is enough. **Shown live on the demo page:** pick `response-directness`
and inject `tck-9001`, `TCK-9001` and ` tck-9001 ` (leading and trailing space), all `helped`; the panel reads
`ADOPT — tally: 3 distinct context(s), helped=3`. The same page with `tck-1` typed identically three times on
`escalation-aggressiveness` reads `HOLD — needs 2 more distinct context(s); tally: 1 distinct, helped=3`. (Both
driven on the deployed URL on 2026-10-23.) The form's blank check is `contextIdText.trim().length > 0`, and
`"\u200b".trim().length` is 1, so a zero-width-only id passes it; I read that and ran `trim()` in the page, but did
not submit one through the form. Pinned by `tests/failures/06-context-id-spelling-drift.test.ts` (five spellings
resolve `adopt`, `distinctContexts` 5) and step 7 of `npm run demo:triage`; probe block 1 prints the four
mechanisms. Closes if whoever mints ids canonicalizes them before they reach `tally`.

**2. No value-range check at all.** Neither `gate` nor `arbitrate` reads `delta.from` or `delta.to` in code, and
`proposeDelta` stores them unchecked. A proposal to move a knob documented as `[0, 1]` to 999,999 **adopts on
its first and only proposal** with three distinct helped contexts — no sequence, no history. The probe also
adopted `-5`, `NaN`, `Infinity`, and a no-op delta whose `to` equals its `from`. Pinned by
`tests/failures/17-no-value-range-check-at-all.test.ts` (999,999 on `escalation-aggressiveness`, -500 on
`response-directness`); `NaN`, `Infinity` and the no-op appear only in the probe (block 2). It is not reachable
from the live form, which cannot set `from` or `to` (they are fixed constants in `DEMO_DELTAS`), only from code
that calls `evaluateDelta`.

**3. Cumulative drift is unchecked, and `arbitrate` cannot detect a caller's wrong prior value.** Nothing
inspects the sequence of values a knob has been adopted to. `tests/failures/09-cumulative-drift-unchecked.test.ts`:
three sequential adopted deltas, each independently corroborated, walk `escalation-aggressiveness` from within
`[0, 1]` to 3.4 and no step is refused. `arbitrate` returns `priorState.replacedValue` as `revertedTo`
verbatim: `tests/failures/10-revert-trusts-caller-supplied-prior-value.test.ts` pins `0.5` coming back where the
true predecessor was `0.8`, with no error; the probe (block 3) echoed `123456`. The demo page assumes the
rollback value is the delta's own `from` (`liveOn()` in `components/compute-demo-view.ts`), which is right
only if nothing else moved the knob in between, and nothing checks.

**4. The majority is over raw episode counts; no reporter identity; no time decay.**
`tests/failures/11-raw-count-majority-dominated-by-volume.test.ts`: one context reporting 1,000 `helped`
episodes plus two other contexts reporting one `harmed` each resolves `adopt`, although two of the three
contexts said `harmed`. The probe (block 4) shows the same with `neutral`: five `helped` episodes from one
context plus one `neutral` each from two others adopts with exactly one context having said `helped`, because
the 3-context floor counts contexts, not contexts that agree. `tests/failures/07-reporter-identity-not-tracked.test.ts`:
five tickets from one customer adopt as five customers would. Episodes carry no weight by age:
`lib/evidence/tally.ts` contains no occurrence of `observedAt`, `tests/failures/08-no-time-decay.test.ts` pins
episodes dated more than a year apart, and the probe adopted on `observedAt` values of `2000-01-01`,
`not-a-timestamp` and `9999-12-31`.

**5. Cast residuals.** A deliberate cast defeats the type-level guard on `proposeDelta` and the source scan of
`knobs.ts`; the **runtime** comparison in `gate` still catches the cast-smuggled knob
(`tests/failures/13-cast-residuals-bypass-type-brands.test.ts`, part a: a runtime-concatenated string cast to
`AdaptableKnobId` still resolves `frozen`). **But a cast-bypassed registry can have its invariant spliced out:**
`x as unknown as InvariantRegistry<K>` around a plain array carries neither the brand nor the freeze, `gate`
does not call `Object.isFrozen`, and on a plain copy with the one invariant removed `gate` returns `eligible`
for `auto-refund-ceiling` (case 13, part b; probe block 5). The shipped `SUPPORT_TRIAGE_REGISTRY` is unaffected
unless code builds and passes such a value. More residuals. (i) The `?: never` fields on `frozen` are checked against a value's static type, so a value that carries `tally` at runtime but whose static type has already dropped it reaches `AdaptationDecision` with no cast and no `any`. Checked in a scratch file with `npm run typecheck`, then deleted: `const widened: { kind: "frozen"; deltaId: BehaviorDeltaId; invariant: InvariantId } = contaminated; const d: AdaptationDecision = widened;` compiled, and so did `flag ? contaminated : plain` and `[contaminated, plain]` when `plain` is an un-annotated literal with no `tally` field; the same two with `plain` annotated `FrozenDecision` did not compile. The field stays on the object and `assertFrozenCitesNoEvidence` returned `ok: false, field: "tally"` for each, so the safety property holds when that guard is called; in this repository it is called on the decision `arbitrate` builds itself and in `/api/health`'s synthetic check, not on a value received from elsewhere. This is a property of TypeScript's structural typing, not of this design, and no test pins it. (ii) A `frozen` value arriving as `any` (for example from `JSON.parse`) type-checks with no error (checked in a scratch file), and `assertFrozenCitesNoEvidence` checks that evidence fields are absent, not where a value came from. (iii) `adopt`, `hold` and `revert` are not defended against carrying each other's stray fields (`lib/contracts/__tests__/adaptation-decision.test.ts`, the three tests under the "HONEST LIMIT" describe block).

**6. `Object.freeze` is one level deep.** Every registry element is frozen, but a field holding an object
would stay mutable. That is true today only because `Invariant` is three primitive fields.
`tests/failures/14-freeze-is-one-level-deep.test.ts` shows a cast-smuggled nested field surviving the freeze;
probe block 5 prints `element frozen: true | nested field after assignment: 99`.

**7. The duplicated knob-matching predicate is pinned textually, not behaviourally.** `gate` and
`arbitrate`'s private `findInvariantForKnob` each contain `invariant.knob === …`; `tests/failures/16-predicate-consistency-pin.test.ts`
reads three source lines and asserts they agree. **A guard clause injected inside `gate()` passes every test.**
Run in a scratch clone: `if (delta.knob === ("__attack_bypass__" as KnobId)) return "eligible";` before the loop
left 384 of 384 tests passing and `typecheck` clean; so did a value-conditional guard,
`if (typeof delta.to === "number" && delta.to > 1_000_000) return "eligible";`, and with it `evaluateDelta` on
`auto-refund-ceiling` with `to: 2000000` and three distinct helped contexts returned `adopt`. The suite
constrains `gate()` only on the inputs it uses.

**8. `eslint.config.mjs` ignores every `.ts` and `.tsx` file.** `npm run lint` exits 0 without reading any
TypeScript, and `npx eslint lib/arbitrate/arbitrate.ts` prints "File ignored because of a matching ignore
pattern". The reason is that `typescript-eslint` does not support TypeScript 7: `npm view typescript-eslint
version peerDependencies` on 2026-10-23 printed `8.72.0` and `typescript: '>=4.8.4 <6.1.0'`, against this
repository's `typescript@7.0.2`. `npm run typecheck` is the backstop, but it is a compiler, not a linter.
Pinned by `tests/failures/15-eslint-config-ignores-typescript.test.ts`. A related coupling: that file shells out
to `npm run typecheck` and `npx eslint` and writes two deliberately broken `.ts` fixtures under
`tests/failures/` (`.scratch-case-15-dotdir-repro/` and `scratch-case-15/`) while it runs and removes them afterwards (untracked entries appear in `git status` during a run; the tree is clean after), so a type error anywhere also fails `npm test` (observed: weakening one
`frozen` field in a scratch clone failed exactly that file), and an interrupted run could leave the fixture
behind.

**9. The demo form's click wiring has no automated test.** In a scratch clone, replacing the `outcome` stored
by `handleInject` with the literal `"helped"` left all 384 tests passing and `typecheck` clean.
`components/__tests__/AdaptiveAgentDemo.test.tsx` uses `renderToStaticMarkup`, which cannot click. The
walkthrough was driven by hand on the live page instead (`docs/NOTES.md` records what it read back). ADR 0008
also records that the `response-directness` "(adaptable)" label is unpinned; I did not re-run that.

**10. `next` was pinned with 11 advisories; this is the state as of 2026-10-23T22:37:52Z.**
`npm audit --json` on the `next@16.3.5` lockfile reported 11 advisories against `next`: 3 critical, 2 high, 5
moderate, 1 low. (The summary line says `critical: 1` because `npm audit` counts packages, not advisories.) The
three critical ones are all remote code execution: GHSA-2464-fhr4-w9xw (Image Optimization API with SVG files;
titled "Unauthenticated"), GHSA-673q-mjm6-r5xr (`use cache` functions returning typed arrays; titled
"Unauthenticated") and GHSA-vcvr-r3jv-pc5j (`next/og` `ImageResponse`). PR #17, merged at 22:34:19Z as
`2879c13`, moved `package.json` on `main` to `"next": "16.4.3"`; `npm audit` on that tree at 22:36:26Z reports no
`next` finding. `/api/health` reported commit `2879c13f3465ef2d8dd6cff502cae15b175b6852` at 22:37:52Z. That
endpoint reports the commit Vercel recorded for the build, not the framework version: I did not fingerprint the
Next.js version the deployment is running, and I did not assess any of the eleven advisories for exploitability
against this app. To re-check: `git show origin/main:package.json | grep '"next"'` and
`curl -s https://adaptive-agent-gamma.vercel.app/api/health`. **Not closed by that bump:** `npm audit` on `2879c13`
still reports four vulnerable packages (2 high: `source-map-js`, `vite`; 2 moderate: `vitest`, `@vitest/mocker`),
and `npm audit --omit=dev` reports one, the high `source-map-js`, which comes in under `next`'s `postcss`.
Nothing in this repository has assessed it.

### Further limits

These are gathered here. Items 12, 13, 17 and 18 were already recorded elsewhere (`lib/arbitrate/policy-constants.ts`, ADR 0008 Decision 6, PR #17's description and ADR 0002 respectively); items 13, 17 and 18 say so, and item 12 is recorded in "What it is not" above.

**11. Nothing consumes the decisions, and the page keeps no state.** See "What it is not". The deployed page
holds its history in `useState`; there is no storage or network call in `app/` or `components/` (grep for
`localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `fetch(`), and a reload returned every panel to zero.

**12. The adopt and revert thresholds are invented.** `MIN_DISTINCT_CONTEXTS_ADOPT = 3` and
`MIN_DISTINCT_CONTEXTS_REVERT = 2` have no data behind them, and the asymmetry between them was never tested
against any real cost of a wrong adoption or a slow revert. `lib/arbitrate/__tests__/asymmetry.test.ts` pins
that the two differ and what each does, not that they are right.

**13. Revert is not sticky.** `arbitrate` is stateless and the demo view-model re-judges the whole monitoring
pool on every episode, so further `helped` contexts can take a reverted knob back to `adopt`. The probe (block 6)
printed `hold -> hold -> adopt -> adopt -> revert -> revert -> adopt -> adopt -> adopt`. ADR 0008, Decision 6
records it; no test pins it. Related, by design (ADR 0006, Decision 3): each phase gets its own episode pool, so
a revert is judged on post-adoption episodes alone.

**14. `frozen` is a statement about well-formed input.** `evaluateDelta` tallies before it gates, so a hostile
episode array attached to `auto-refund-ceiling` returns `{ ok: false, … hostile-episodes-input }`, not
`frozen` (probe block 5). It fails closed; it is not a bypass. No committed test pins that combination.

**15. The type-level refusals are enforced by `tsc`, not by `npm test`.** Every `TYPE-LEVEL` test passes under
`vitest` whatever the types say. In a scratch clone, changing `frozen`'s `tally?: never` to
`tally?: EvidenceTally` made `npm run typecheck` fail with `TS2578` and left the contracts tests passing. Run both.
Of the seven routes ADR 0001 counts for evidence leaking onto `frozen`, six have a committed test; the
`satisfies` route does not (re-run in a scratch file, it fails with `TS1360`).

**16. Only two import-direction edges are tested.** `lib/` never names `domains/`, and `lib/invariants` never
imports `lib/evidence`. The rest of the one-directional graph in the definition of done holds today by a grep
(`docs/ARCHITECTURE.md` shows it), not by a test.

**17. The suite is not load-proof.** Two 10,000-episode tests in `components/__tests__/` took 3.3 s and 2.6 s in a
verbose run, against vitest's 5 s default timeout. With one busy loop per CPU core running, `compute-demo-view.test.ts`'s
"10,000 synthetic helped episodes across 10,000 distinct contexts still resolves frozen" failed with
`Test timed out in 5000ms` (1 of 384). PR #17's description records the same flake. The cost comes from
`computeKnobView` re-tallying after every episode: for one knob it took 241 ms at 4,000 episodes and 1,255 ms at
8,000 (one run, this machine).

**18. Several checks have no test.** `npm run demo:triage` is run by hand (no test file invokes it), and
`/api/health` has no committed test (ADR 0002 records a manual break-and-revert proof).

**19. Plan items this milestone does not deliver.** `.genesis/PLAN.md` §3 (M9) names a drift guard,
`app/milestones.test.ts`; it does not exist, and `app/**` was not changed in this milestone. The Loom recording
has not been made. `.genesis/DONE.html` (locked) says the failure suite has "ten" cases; it has 17.

**20. `hold` has one number, and it is `0` for two different blockers.** `distinctContextsNeeded` counts only the distinct-context shortfall. It is `0` when a candidate has enough contexts but no helped-majority (2 `helped` and 3 `harmed` contexts) and also when a different change is already live on the knob (10 distinct `helped` contexts), so the decision does not say which blocker applies; the demo page prints `HOLD — needs 0 more distinct context(s)` for the first. Pinned by `tests/failures/12-hold-distinctContextsNeeded-is-zero.test.ts` (routes 2 and 3; route 1 shows the number is honest when contexts are the shortfall); ADR 0005, Decision 5 records it. `AdaptationDecision.hold` has no field for a reason, and adding one is a change to `lib/contracts`.

## Stack

Next.js 16.4.3 (App Router) and React 19.3.0, TypeScript 7.0.2, Vitest 5.0.1, deployed to Vercel
(`vercel.json` pins `installCommand` to `npm ci` and `buildCommand` to `npm run build`). `lib/` is framework-free.
Versions are the exact pins in `package.json`.

## Documents

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stage by stage, what each stage refuses, each refusal cited to a test (one is marked as having none).
- [`docs/THESIS.md`](docs/THESIS.md) — the claim, where to disagree with it, and what would make it fail.
- [`docs/NOTES.md`](docs/NOTES.md) — how it was built and verified, reconstructed from `git`, `gh` and the ADRs.
- [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) — the script for the live demo, estimated at about 80 seconds.
- [`.genesis/PLAN.md`](.genesis/PLAN.md), [`.genesis/DONE.html`](.genesis/DONE.html) and
  [`.genesis/decisions/`](.genesis/decisions/) — the plan, the locked definition of done, and eight ADRs.
