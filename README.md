# Adaptive Agent

Whether an agent's proposed change to its own future behavior has earned the right to stick, based
on independent, diverse evidence rather than one loud incident.

A self-adapting agent proposes changes to its own behavior knobs based on what it observes. The hard
problem this project targets is refusing to let a change stick on the strength of one repeated
incident — corroboration is counted by distinct occasion (`contextId`), never by episode count — while
a fixed set of invariant-protected knobs can never be touched by any amount of evidence at all, and a
previously adopted change that turns out to have made things worse can be honestly and provably
reversed. See `.genesis/PLAN.md` for the full claim, the closed `AdaptationDecision` vocabulary, and
the nine-milestone plan.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript, deployed to Vercel
- Vitest for tests, `lib/` kept framework-free
- Build uses the webpack bundler explicitly (`next dev --webpack`, `next build --webpack`) with
  `experimental.extensionAlias` set in `next.config.ts` — Turbopack (Next 16's default) cannot
  resolve the NodeNext-style `.js`-suffixed relative imports `lib/` will use once it exists; see the
  comment in `next.config.ts` for the full reasoning.

## Running it

```bash
npm ci            # never `npm install` for restoring deps — see the note below
npm run dev       # local dev server
npm run typecheck # tsc against both tsconfig.lib.json and tsconfig.json
npm test          # vitest
npm run build     # production build
npm run lint      # next lint
```

**Always use `npm ci`, not `npm install`, to restore dependencies.** npm 11.5.1 has a documented bug
where `install` against an existing lockfile can silently drop the platform-specific
`@rolldown/binding-*` package that Vitest resolves through, and `npm test` then fails with a bare
"Cannot find native binding" that gives no hint the *install*, not the code, is at fault. `npm ci`
does not have this problem.

## Status

This is a genesis-only repository. It has the tooling skeleton, the `.genesis/` planning artifacts,
and a placeholder home page — no engine code and no domain logic yet beyond `lib/contracts/**` (M1,
frozen) and the M2 deploy skeleton below. `lib/contracts/**` is a separate milestone with its own PR
and its own independent verifier, and each of the other eight milestones in `.genesis/PLAN.md` follows
the same pattern.

**Live:** <https://adaptive-agent-gamma.vercel.app> — deployed at milestone 2, deliberately early
rather than left to the end (the house rule this project's siblings all follow: a prior hackathon
project that deferred deployment to the end never shipped a live URL at all).

`GET /api/health` runs a real self-check against `lib/contracts` — it exercises
`assertFrozenCitesNoEvidence` (the one M1 contracts function with genuine runtime branching) in both
directions, a well-formed `frozen` decision and one that reached the same type only through an unsafe
cast while carrying evidence, and reports the deployed commit SHA. It returns `503`, not `200`, if
either check fails. See `.genesis/decisions/0002-deploy.md` for the full reasoning and the local
proof that it actually flips to `503` under a real regression.
