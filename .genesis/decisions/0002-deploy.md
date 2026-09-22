# ADR 0002 — M2 deploy skeleton: what the health endpoint actually checks, the webpack build pin, and how the live deploy was verified

- **Date:** 2026-09-23
- **Status:** accepted
- **Phase / milestone:** M2 (BUILD) — `app/api/health/**`, deploy

## Context

`.genesis/PLAN.md` §3 (M2) commits this milestone to a live Vercel deployment "from the very first
merged PR after M1," a `GET /api/health` that "runs a real self-check against `lib/contracts`" and
"reports the deployed commit SHA," and refuses "to return 200 on a bare liveness ping with no real
check behind it." This ADR records what that self-check actually exercises, why, and how the deploy
itself was proven to match the branch's real `HEAD` rather than an uncommitted working tree.

## Decision 1 — the self-check exercises `assertFrozenCitesNoEvidence`, not `assertNeverAdaptationDecision`

`lib/contracts` (M1, frozen) exports two functions that touch `AdaptationDecision` at runtime:
`assertNeverAdaptationDecision` and `assertFrozenCitesNoEvidence`. Only the second has genuine runtime
branching to exercise. `assertNeverAdaptationDecision(value: never): never` is an exhaustiveness
guard — its own file's header states it is "never called at runtime... for any value TypeScript
itself considers reachable," and M1's own test suite proves the mechanism on a **local, throwaway
five-kind stand-in union**, not the real four-variant type, for exactly that reason. There is no
honest way for a live HTTP endpoint to call it against a real `AdaptationDecision` value without
first fabricating an unreachable fifth variant — doing that here would either require importing
something that does not exist in this milestone's scope or writing a local stand-in inside the route
file itself, neither of which checks anything about the shipped system a reader couldn't already infer
from `tsc` passing. `assertFrozenCitesNoEvidence` is the one function in M1 doing real, inspectable
work at request time — a runtime field-presence check with a genuine pass/fail branch — so it is what
this endpoint exercises, in both directions:

1. **A well-formed `frozen` decision**, constructed as a literal (`kind: "frozen"`, `deltaId`,
   `invariant`, no evidence field) — the type itself (`tally?: never`, `distinctContextsNeeded?:
   never`, `revertedTo?: never`) already refuses to let this literal carry evidence, so this is the
   ordinary, uncorrupted construction path every real caller uses. Expected: `{ ok: true }`.
2. **A value that reaches the identical `FrozenDecision` type only via an unsafe `as unknown as
   FrozenDecision` cast**, carrying a real, populated `tally`. This is the exact residual
   `.genesis/decisions/0001-contracts.md` (Decision 1) names as the one route the type system cannot
   close on its own, and the same document records calling `assertFrozenCitesNoEvidence` at every
   `frozen`-decision consumer as a **build requirement for M5's `arbitrate`** — this endpoint is the
   first place in the codebase that requirement is actually exercised, ahead of M5 existing. Expected:
   `{ ok: false, error: { kind: "unexpected-evidence-on-frozen", field: "tally" } }`.

**What would make this endpoint report unhealthy:** either assertion failing (a real regression in
`assertFrozenCitesNoEvidence`), or the check throwing at all. **Proven, not just asserted:** the
`tally` branch was temporarily dropped from the field loop inside `assertFrozenCitesNoEvidence`
(`lib/contracts/adaptation-decision.ts`) in a local working copy, `next dev` was run, and
`curl localhost:3000/api/health` returned `503` with `"status":"degraded"` and
`contaminatedCaught=false` in the detail message; the file was then restored byte-for-byte
(`git diff main -- lib` returned empty afterward) and the same request returned `200`/`"status":"ok"`
again. `lib/contracts/**` was never committed in its broken state at any point — the break-and-revert
happened entirely in a local working copy between two verification runs, matching this account's own
standing discipline (see `0001-contracts.md`'s own falsifiability log) of proving a check catches a
real regression rather than trusting that it would.

## Decision 2 — commit SHA sourced from `VERCEL_GIT_COMMIT_SHA`, never fabricated

`process.env.VERCEL_GIT_COMMIT_SHA` is set by Vercel on every deployment and is absent in local dev.
The endpoint reports it verbatim when present and the literal string `"unknown (local dev)"` when
absent — never a guessed or hardcoded SHA. A health endpoint whose one distinguishing feature is
"proves what's live matches what's in the repo" would defeat its own purpose by fabricating that value
when it doesn't have it.

## Decision 3 — `vercel.json` pins `installCommand`/`buildCommand`; the framework-preset default was checked, found wrong, and overridden

`next.config.ts` (landed at M1, for the same `.js`-suffixed-import reason `package.json`'s
`build`/`dev` scripts already pass `--webpack`) requires the build to run through webpack, not
Turbopack — that file's own comment states Turbopack "fails outright... for every one of lib/'s
internal `.js`-suffixed imports," no Turbopack option in this Next version works around it. Locally,
`npm run build` guarantees webpack because it always resolves to the `package.json` script. Vercel's
zero-config Next.js framework preset was **not** assumed to do the same without checking — and the
check found it does not: `vercel link`'s own output, before any `vercel.json` existed in this tree,
reported `Detected Next.js (Build Command: next build, Output Directory: Next.js default)` — plain
`next build`, i.e. Turbopack, the exact case `next.config.ts` documents failing. Left uncorrected,
the platform default would have built with the one bundler this project's own `lib/` cannot compile
under. Separately, no install command was pinned either, leaving the platform's own default install
step exposed to the identical `npm install`-drops-`@rolldown/binding-*` risk this repo's README
already warns local contributors about for the same lockfile.

**The fix:** `vercel.json` (tracked, committed in `9a23862`) pins `installCommand: "npm ci"` and
`buildCommand: "npm run build"` — the same two commands `npm ci`/`npm run build` already run locally,
so the deployed build is not a second, divergent build configuration, just the local one, pinned.
**Verified after deploy, not just after adding the override:** the actual Vercel build log (pasted in
the PR/report) shows `Running "install" command: npm ci...`, then `Running "npm run build"` →
`> next build --webpack` → `▲ Next.js 16.3.5 (webpack)`, the same banner the local build prints — so
the override is confirmed to have taken effect, not merely assumed from `vercel.json` being present.

## Decision 4 — deploy from a clean, fully-committed tree at the branch's real `HEAD`, verified after the fact

A sibling project's M8 was rejected because `vercel deploy` ran against an uncommitted working tree:
the CLI uploads the working tree as the build source regardless of `git` state, but
`VERCEL_GIT_COMMIT_SHA` is read from `HEAD` at deploy time — so an uncommitted change makes the
deployed *code* and the reported *SHA* disagree, silently. This milestone's deploy sequence was:
commit everything on `m2-deploy` first, confirm `git status --short` is empty, run `vercel deploy`
against that exact tree, then `curl` the live `/api/health` and diff its `commit` field against
`git rev-parse HEAD` on the branch — recorded as passing in the PR/report, not merely assumed from the
deploy command exiting zero.

## Decision 5 — token handling

`VERCEL_TOKEN` was passed to the `vercel` CLI as a shell environment variable for each invocation only
— never written into `vercel.json`, `.env*`, a commit, or this document (this sentence deliberately
does not spell out the token's own literal prefix, so a grep for that prefix over this repository's
own history is not defeated by this file describing the check). `.vercel/` and `.env*.local` were
confirmed present in `.gitignore` (both already covered before M1, unchanged here) before any `vercel`
command ran. A grep of the full commit history for the token's prefix was run after the deploy and
returned zero matches, checked directly rather than assumed from following the token-handling rule
correctly.

## What this milestone does not claim

- This endpoint does not, and is not claimed to, exercise `lib/evidence`, `lib/invariants`, or
  `lib/arbitrate` — none of the three exist yet (M3–M5, unbuilt). Widening this check to cover them
  before they exist would make this file a second, drifting copy of a future milestone's own test
  suite rather than an honest report of what is live today.
- `assertFrozenCitesNoEvidence`'s own documented limit (from `0001-contracts.md`) still applies here:
  it detects the *presence* of a foreign evidence field on a value that reached the `FrozenDecision`
  type via a cast — it does not, and cannot, verify that a forged-but-well-formed evidence field
  never existed in the first place if the caller fabricated one that also passed field-presence
  checks some other way. This endpoint's second check exercises exactly the presence-detection this
  function actually provides, not a stronger guarantee it doesn't make.
