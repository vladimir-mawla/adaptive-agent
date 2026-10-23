# Adaptive Agent

Whether an agent's proposed change to its own future behavior has earned the right to stick, based
on independent, diverse evidence rather than one loud incident.

**Live:** <https://adaptive-agent-gamma.vercel.app> — a page where you inject episodes and watch the real
engine rule on them. `GET /api/health` runs a self-check and reports the deployed commit. All times in this
document are UTC.

## What this is

A candidate change to one behavior knob (a `BehaviorDelta`) and a stream of evidence about it (`Episode`s,
each with a `contextId` and an outcome of `helped`, `neutral` or `harmed`) pass through three stages —
`tally` → `gate` → `arbitrate` — and come out as exactly one of four decisions:

| Decision | Meaning | When |
|---|---|---|
| `adopt` | the change sticks | at least 3 distinct `contextId`s, and more `helped` episodes than `neutral` + `harmed` |
| `hold` | not yet; says how many more distinct contexts it needs | evidence short of that bar, or a different change is already live on the knob |
| `revert` | an adopted change is rolled back to the value it replaced | at least 2 distinct post-adoption contexts, and more `harmed` episodes than `helped` + `neutral` |
| `frozen` | refused outright | the knob is named by an `Invariant`; the evidence's counts are never read |

The refusal this exists to make: one ticket complained about 500 times is one occasion
(`distinctContexts: 1`), not 500, because corroboration is counted by distinct `contextId`, never by
episode count. The adopt bar (3) is higher than the revert bar (2) on purpose. `docs/ARCHITECTURE.md`
walks each stage and cites a test for every refusal; `docs/THESIS.md` says what a reader should disagree
with.

**What it is not.** There is no agent in this repository. The "support-triage agent" is three knobs, one
invariant (`auto-refund-ceiling`), a scenario, and `evaluateDelta`, the function that composes the three
stages. Decisions are returned, never applied: the only callers of `evaluateDelta` are
`scripts/demo-triage.ts`, the demo page's view-model, and tests. The thresholds 3 and 2 are invented policy
constants (`lib/arbitrate/policy-constants.ts` says so), and every episode in the repository is synthetic.

## Try it

- Open the live page and follow `docs/WALKTHROUGH.md` (about 80 seconds). Three helped tickets move
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
  seconds each on their own.
- `npm run demo:triage` prints nine steps — `hold` three times, `adopt`, `adopt`, `revert`, `adopt` for one
  ticket spelled three ways, then `frozen` twice — and exits 0 only if all four decision kinds were observed.
  No test runs it.
- `npm run dev` serves the page on <http://localhost:3000>; `npm run build` makes a production build. Both pass
  `--webpack` (see `next.config.ts` for why Turbopack is not used).
- `npm run lint` is `eslint .` and **does not read any TypeScript**.

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

## Stack

Next.js 16.4.3 (App Router) and React 19.3.0, TypeScript 7.0.2, Vitest 5.0.1, deployed to Vercel
(`vercel.json` pins `installCommand` to `npm ci` and `buildCommand` to `npm run build`). `lib/` is framework-free.
Versions are the exact pins in `package.json`.

## Documents

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stage by stage, what each stage refuses, each refusal cited to a test.
- [`docs/THESIS.md`](docs/THESIS.md) — the claim, where to disagree with it, and what would make it fail.
- [`docs/NOTES.md`](docs/NOTES.md) — how it was built and verified, reconstructed from `git`, `gh` and the ADRs.
- [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) — the ~80-second script for the live demo.
- [`.genesis/PLAN.md`](.genesis/PLAN.md), [`.genesis/DONE.html`](.genesis/DONE.html) and
  [`.genesis/decisions/`](.genesis/decisions/) — the plan, the locked definition of done, and eight ADRs.
