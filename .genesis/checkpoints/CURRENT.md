# CURRENT

- **active_loop:** none. All nine milestones (M1–M9) are marked `done` in `.genesis/DONE.html` §3. The
  only outstanding item is the user's own 90-second Loom recording.

- **last updated:** 2026-10-24, after M9 merged as #18 (`2aa5095`). The previous revision of this file
  was written at genesis on 2026-09-22 and said M1 had not started; none of the M1–M8 mark-done PRs
  touched it, so it was out of date for the whole build and is rewritten here rather than patched.

## Milestone state, as of this revision

| | Status | Where (merged PR → squash commit on `main`) |
|---|---|---|
| M1 contracts | `done` | #1 → `f15412d` |
| M2 deploy | `done` | #3 → `74b6458` |
| M3 evidence tallying | `done` | #4 → `8ccf08b` |
| M4 the invariant gate | `done` | #7 → `2ce7b8c` |
| M5 arbitration | `done` | #9 → `75af9ed` |
| M6 domain (support-triage) | `done` | #11 → `ca455be` |
| M7 failure suite | `done` | #13 → `d8326cc` |
| M8 interactive demo | `done` | #15 → `fc0b65d` |
| M9 deliverables | `done` | #18 → `2aa5095`; independent (L4) verdict APPROVE in round 3 |

The rows were flipped in `.genesis/DONE.html` by separate mark-done PRs: #2 (M1), #6 (M2 and M3 together), #8,
#10, #12, #14 and #16 (M4 to M8), and the PR that carries this file (M9).

## What was run for this revision

In a fresh clone of `main` at `2aa5095`, on Node v24.7.0 and npm 11.5.1, on 2026-10-24:
`npm ci && npm run typecheck && npm test && npm run build` exited 0. `npm test` printed
`Test Files  44 passed (44)` and `Tests  384 passed (384)`. That is the M9 row's own demo command
(`git clone ... && npm ci && npm run typecheck && npm test`) plus `npm run build`.

The live demo is at <https://adaptive-agent-gamma.vercel.app>. `/api/health` reports the commit Vercel built,
so read it with `curl` when it matters; no SHA is written down here, because a SHA written in a document is
the kind of statement that goes stale the next time `main` moves.

## Outstanding

- The 90-second Loom recording. `.genesis/PLAN.md` §3 (M9) sets the length at 90 seconds. `docs/WALKTHROUGH.md`
  is the script and estimates about 80. The recording has not been made, and it is the user's to make.

## Known gaps in this repository's own record, stated up front rather than discovered later

- The independent (L4) verification transcripts are not in the repository (`docs/NOTES.md` §1). The M9
  verdict above, APPROVE in round 3, is recorded as reported by the run that coordinated the verification;
  nothing in this repository lets a reader check it.
- `.genesis/PLAN.md` §3 (M9) names a drift guard, `app/milestones.test.ts`, that is meant to confirm
  milestone claims against `.genesis/DONE.html`. It does not exist (`app/` holds `api/`, `globals.css`,
  `layout.tsx` and `page.tsx`); `README.md` and `docs/NOTES.md` §9 item 7 record this.
- `.genesis/DONE.html` is locked and still carries genesis-era sentences that no longer hold, such as
  "Updated: 2026-09-22" and the two notes saying no engine code exists yet. They were left as written.
  `docs/NOTES.md` §6 and §9 list other statements in the record that the repository does not support.
- This checkpoint has no `model:` field, matching the sibling projects' own noted gap: which model
  did this work is not recoverable from the repository alone. The `Co-Authored-By` trailer on every
  commit is a fixed string the harness writes regardless of which model did the work, and must not be
  read as authorship evidence.
