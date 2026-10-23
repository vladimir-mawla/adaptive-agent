# Notes: how this was built, reconstructed from primary sources

This is a process record. Every number, time and SHA below came from a command run while writing it, and the
commands are named. Where the repository does not record something, this document says so instead of
inferring it. All times are UTC.

## 1. Sources, and what is not one

**Used:** `git log origin/main` and `git log --remotes`; `gh pr list --state all --limit 100 --json
number,title,createdAt,mergedAt,closedAt,state,headRefName,mergeCommit,additions,deletions,changedFiles`;
`gh pr view N --json comments,reviews,commits` for N = 1 to 17; `gh api repos/vladimir-mawla/adaptive-agent/pulls/N/commits
--paginate` and `gh api 'repos/vladimir-mawla/adaptive-agent/commits?sha=main&per_page=100'` (for the account GitHub
resolves each commit to); the eight ADRs in `.genesis/decisions/`, `.genesis/PLAN.md`, `.genesis/DONE.html` and
`.genesis/checkpoints/CURRENT.md`; and `vitest` and `tsc` re-run at every commit on `main`.

**Not sources:** transcripts of the independent verification ("L4 VERIFY"), which are not in the repository; the
Loom, which has not been recorded; anyone's memory. Merge times below are `mergedAt`, not `createdAt` and not a
commit date.

**Snapshot.** Collected on 2026-10-23. The first PR listing, taken before 22:17:55, showed 16 PRs and `main` at `44e42b4`.
PR #17 was opened at 22:17:55 and merged at 22:34:19, and the tables below were refreshed after that, so `main` is
`2879c13` and they include #17. This milestone's own PR is not in them.

## 2. Timeline

| PR | Title (verbatim) | `createdAt` | `mergedAt` | Open for | Branch commits | Files | Lines | Main SHA |
|---|---|---|---|---|---|---|---|---|
| #1 | M1 — Contracts (lib/contracts/**) | 2026-09-22T21:22:03Z | 2026-09-22T22:02:47Z | 0 h 40 m 44 s | 14 | 15 | +1525 / −0 | f15412d |
| #2 | chore(genesis): mark M1 done -- contracts, 1 of 9 | 2026-09-22T22:03:41Z | 2026-09-22T22:04:21Z | 0 h 00 m 40 s | 1 | 1 | +1 / −1 | b94491b |
| #3 | M2 — Deploy a live skeleton to Vercel | 2026-09-22T22:19:15Z | 2026-09-22T22:46:39Z | 0 h 27 m 24 s | 7 | 5 | +361 / −4 | 74b6458 |
| #4 | M3 — Evidence tallying (tally) | 2026-09-23T06:21:13Z | 2026-09-23T06:32:51Z | 0 h 11 m 38 s | 4 | 6 | +827 / −0 | 8ccf08b |
| #5 | M3 ADR: name the spelling-drift context-collision gap L4 VERIFY flagged | 2026-09-23T06:38:30Z | — (closed unmerged at 2026-09-23T06:39:15Z) | 0 h 00 m 45 s | 5 | 6 | +907 / −0 | — |
| #6 | M3 ADR disclosure + mark M2 and M3 done -- 3 of 9 | 2026-09-23T06:40:03Z | 2026-09-23T06:40:41Z | 0 h 00 m 38 s | 2 | 2 | +82 / −2 | 8778282 |
| #7 | M4 — The invariant gate (lib/invariants/**) | 2026-09-30T17:48:39Z | 2026-09-30T17:58:58Z | 0 h 10 m 19 s | 7 | 6 | +887 / −0 | 2ce7b8c |
| #8 | chore(genesis): mark M4 done -- the invariant gate, 4 of 9 | 2026-09-30T17:59:50Z | 2026-09-30T18:00:17Z | 0 h 00 m 27 s | 1 | 1 | +1 / −1 | c1fe444 |
| #9 | M5 — Arbitration (lib/arbitrate) | 2026-09-30T18:15:34Z | 2026-09-30T18:40:28Z | 0 h 24 m 54 s | 12 | 10 | +1308 / −0 | 75af9ed |
| #10 | chore(genesis): mark M5 done -- arbitration, 5 of 9 | 2026-09-30T18:41:17Z | 2026-09-30T18:41:51Z | 0 h 00 m 34 s | 1 | 1 | +1 / −1 | f391382 |
| #11 | M6 -- Domain: support-triage agent (domains/support-triage) | 2026-09-30T18:59:01Z | 2026-09-30T19:13:59Z | 0 h 14 m 58 s | 8 | 12 | +1177 / −1 | ca455be |
| #12 | chore(genesis): mark M6 done -- support-triage domain, 6 of 9 | 2026-09-30T19:14:42Z | 2026-09-30T19:15:10Z | 0 h 00 m 28 s | 1 | 1 | +1 / −1 | 9f86904 |
| #13 | M7 -- The failure suite (tests/failures/**) | 2026-09-30T19:37:15Z | 2026-09-30T20:06:43Z | 0 h 29 m 28 s | 21 | 19 | +2093 / −0 | d8326cc |
| #14 | chore(genesis): mark M7 done -- failure suite, 7 of 9 | 2026-09-30T20:07:27Z | 2026-09-30T20:07:55Z | 0 h 00 m 28 s | 1 | 1 | +1 / −1 | 7b7ef2d |
| #15 | M8 -- The interactive demo (app/, components/) | 2026-09-30T20:42:23Z | 2026-10-23T22:04:03Z | 23 d 1 h 21 m 40 s | 20 | 9 | +1732 / −27 | fc0b65d |
| #16 | chore(genesis): mark M8 done -- interactive demo, live, 8 of 9 | 2026-10-23T22:06:43Z | 2026-10-23T22:07:09Z | 0 h 00 m 26 s | 1 | 1 | +1 / −1 | 44e42b4 |
| #17 | security: upgrade next 16.3.5 -> 16.4.3 (3 critical RCE advisories) | 2026-10-23T22:17:55Z | 2026-10-23T22:34:19Z | 0 h 16 m 24 s | 1 | 2 | +160 / −160 | 2879c13 |

Counted from the table and the commands above:

- 17 PRs: 16 merged, 1 closed without merging (#5), 0 open at the snapshot.
- 107 commit entries across the 17 PR branches (102 in the 16 merged PRs, 5 in #5), from `gh pr view N --json commits`; 103
  of them are distinct SHAs, because four commits appear in both #4 and #5.
- `main` has 21 commits: 5 pushed straight to it before any PR (GitHub author dates 2026-09-22T21:03:26Z to
  21:05:45Z) and 16 squash commits, one per merged PR.
- Merges landed on four UTC dates: 2026-09-22 (#1 to #3), 2026-09-23 (#4, #6), 2026-09-30 (#7 to #14) and
  2026-10-23 (#15 to #17). From the first commit to the last merge is 31 d 1 h 30 m 53 s.
- #6 merged at 2026-09-23T06:40:41Z and #7 was opened at 2026-09-30T17:48:39Z, a gap of 7 d 11 h 07 m 58 s. The
  repository does not say why.
- #15 was open for 23 d 1 h 21 m 40 s. ADR 0008 (dated 2026-09-30) records, in Decision 7, that at that revision
  deployment was blocked because the Vercel CLI was logged out and the token was being rotated. The repository
  records nothing else about why the interval was long, except the message of the merge-chore commit `44e42b4`, which says M8
  "merged as #15 after four verification rounds".
- ADR dates: 0001 to 0003 carry 2026-09-23, and 0004 to 0008 carry 2026-09-30. ADR 0008 reached `main` 23 days
  after the date it carries.
- #5 was closed unmerged. Its one human comment (2026-09-23T06:39:14Z) says it was superseded because its branch
  contained commits already squash-merged as #4, and that the ADR commit was cherry-picked onto a fresh branch. #6
  (`m3-adr-disclosure`, 2 commits) was opened at 06:40:03 and merged 87 seconds after that comment.
- M2 and M3 were marked done together, in #6. M1, M4, M5, M6, M7 and M8 each have a PR of their own for that (#2,
  #8, #10, #12, #14, #16).
- 0 formal GitHub reviews on any PR. Comments: 5 from a human account (#1 twice, #5 once, #13 twice) and 15 from the
  Vercel bot, one each on #3 to #17. #1 and #2 have no bot comment.

## 3. Test counts at every commit on `main`

For each commit, in a throwaway clone: `git checkout --detach <sha>`, `rm -rf node_modules`, `npm ci`, `npx vitest run`,
`npm run typecheck`. `npm ci` and `vitest` exited 0 at all 17.

| Commit on `main` | PR | What | Test files | Tests | `typecheck` exit | What the repository claimed | Verdict |
|---|---|---|---|---|---|---|---|
| `b6960cd` | — | genesis, last of 5 direct commits | 1 | 2 | 0 | PR #1 body: "2 pre-existing smoke" tests | agrees |
| `f15412d` | #1 | M1 merged | 7 | 45 | 0 | ADR 0001: "45/45 passing"; PR #1 comment: "45/45 passing (up from 29)" | agrees |
| `b94491b` | #2 | M1 marked done | 7 | 45 | 0 | docs-only commit (`.genesis/DONE.html`) | unchanged |
| `74b6458` | #3 | M2 merged | 7 | 45 | 0 | PR #3 body: "7 files / 45 tests passing (unchanged from main)" | agrees |
| `8ccf08b` | #4 | M3 merged | 10 | 215 | 0 | ADR 0003: 215 ("6 of 215"); PR #4 body: "215/215" | agrees |
| `8778282` | #6 | M3 ADR disclosure, M2 and M3 marked done | 10 | 215 | 0 | docs-only change | unchanged |
| `2ce7b8c` | #7 | M4 merged | 14 | 237 | 0 | ADR 0004: "237/237" | agrees |
| `c1fe444` | #8 | M4 marked done | 14 | 237 | 0 | docs-only commit | unchanged |
| `75af9ed` | #9 | M5 merged | 20 | 270 | 0 | ADR 0005: 266 when its experiments ran, then "grown from 266 to 269" plus one test; PR #11 body: "270 -> 297 tests, 20 -> 24 files" | agrees (270 is the sum; the ADR does not print it) |
| `f391382` | #10 | M5 marked done | 20 | 270 | 0 | docs-only commit | unchanged |
| `ca455be` | #11 | M6 merged | 24 | 297 | 0 | PR #11 body: "270 -> 297 tests, 20 -> 24 files" | agrees |
| `9f86904` | #12 | M6 marked done | 24 | 297 | 0 | docs-only commit | unchanged |
| `d8326cc` | #13 | M7 merged | 41 | 342 | 0 | PR #13 comments: "41 files / 342 tests" and "17 files / 45 tests" for `npm test -- failures`; ADR 0008: "`main` at M7 is 41 files / 342 tests". PR #13's opening body says "39 files / 334 tests" | agrees with the comments and the ADR; the opening body is stale |
| `7b7ef2d` | #14 | M7 marked done | 41 | 342 | 0 | docs-only commit | unchanged |
| `fc0b65d` | #15 | M8 merged | 44 | 384 | 0 | ADR 0008: "44 files / 384 tests" | agrees |
| `44e42b4` | #16 | M8 marked done | 44 | 384 | 0 | docs-only commit | unchanged |
| `2879c13` | #17 | `next` 16.3.5 → 16.4.3 | 44 | 384 | 0 | PR #17 body: "44 files / 384 tests, same as baseline" | agrees |

Differences between the milestone-merge rows, computed from the table: M1 +6 files and +43 tests; M2 +0 and +0; M3 +3
and +170; M4 +4 and +22; M5 +6 and +33; M6 +4 and +27; M7 +17 and +45; M8 +3 and +42. Two of those agree with other
sources: M7's +17 files and +45 tests equal what `npm test -- failures` prints (17 files, 45 tests, re-run for this
document), and M8's +42 equals ADR 0008's "the 42 tests this milestone owns". M5's +33 is the 29 ADR 0005 attributes to
it when its experiments ran, plus the three `tally.deltaId` tests and one JSON.parse test the same ADR says were added
later.

The only disagreements are in the opening text of PR bodies, which are not updated when later rounds change the
numbers: PR #13's body says 39 files / 334 tests and 15 files / 37 tests for `failures` (merged: 41 / 342 and 17 / 45),
and PR #1's body says 29 passed (its own later comment says "up from 29" to 45). This table prefers the re-run to any
body.

**ADR experiments re-run.** The stubs were written for this document, not recovered from the original sessions, and ADR
0008 itself says counts depend on how a mutant is built.

| ADR | Experiment | ADR's number | Re-run |
|---|---|---|---|
| 0003 | `distinctContexts: contexts.size` → `values.length` in `lib/evidence/tally.ts` | 6 of 215 fail | 6 failed, 209 passed, at `8ccf08b` |
| 0004 | body of `gate` replaced by `return "eligible";` | 230 of 237 pass | 7 failed, 230 passed, at `2ce7b8c` |
| 0008 | body of `computeKnobView` replaced by a stub that ignores `inputs` | 355 of 384 pass, 29 fail | 29 failed, 355 passed, `typecheck` exit 0, at `44e42b4` |

## 4. What the repository records about verification rounds

The repository holds ADRs, PR comments and commit messages. It does not hold the verification transcripts, so the number
of rounds for M2 to M6, and for M8's third and fourth, cannot be reconstructed beyond what is below.

| Milestone | What is recorded (as the ADR or PR names it; not necessarily exhaustive) | Where |
|---|---|---|
| M1 | A rejection that found the `frozen` claim false (seven bypass routes compiled), then a second pass that corrected three wording overstatements | ADR 0001, Decision 1 (heading "REVISED AFTER L4 VERIFY REJECTION (round 2)", sub-headings "Round 1" and "Round 2"); PR #1 comments at 21:43:50 and 22:02:21; merged 22:02:47, 26 seconds after the second comment |
| M2 | "this round's independent review of the ADR-only redeploy" | ADR 0002, Decision 2 (the phrase "L4 VERIFY" does not occur in it) |
| M3 | A spelling-drift gap flagged by L4 VERIFY, disclosed by a follow-up ADR commit | PR #5's title; ADR 0003 |
| M4 | One finding: the freeze is one level deep | ADR 0004 |
| M5 | A missing `tally.deltaId` check, an overclaim in Decision 6, a third proof added to Decision 7, and a duplicated-predicate coupling risk "named by L4 VERIFY" | ADR 0005 |
| M6 | A cast defeats both layers on `knobs.ts`; and the consequence that `npm run lint` passing is no check on TypeScript, "confirmed by L4 VERIFY" | ADR 0006 |
| M7 | "Round 2": three findings (a false typecheck claim in case 15, an incompletely reasoned predicate-drift deferral, no value-range check) | ADR 0007; PR #13 comments at 19:57:52 and 20:06:22 |
| M8 | Sections headed "Round 2" and "Round 3 — L4 VERIFY's second rejection"; the merge-chore commit says "four verification rounds" and that "Every later rejection was a sentence written during the previous fix" | ADR 0008; commit `44e42b4` |

Counted: ADR headings that name a numbered round are 0001 (the Decision 1 heading, which says "round 2", and two sub-headings), 0007 (one) and 0008 (two). Occurrences of
the phrase "L4 VERIFY" per ADR, which counts the phrase and not rounds: 0001: 9, 0002: 0, 0003: 0, 0004: 1, 0005: 6,
0006: 4, 0007: 6, 0008: 8 (`grep -o 'L4 VERIFY' <file> | wc -l`).

## 5. Authorship, compared like with like

`gh api repos/vladimir-mawla/adaptive-agent/pulls/N/commits --paginate --jq '[.[]|.author.login]'` for each PR, and `gh api
'repos/vladimir-mawla/adaptive-agent/commits?sha=main&per_page=100'`:

| Set of commits | Count | GitHub resolves the author to | Committer |
|---|---|---|---|
| Branch commit entries in the 17 PRs (103 distinct SHAs) | 107 | `vldmr-mawla`, all 107 | not collected |
| Pushed straight to `main`, before any PR | 5 | `vldmr-mawla` | `vldmr-mawla` |
| Squash commits on `main`, one per merged PR | 16 | `vladimir-mawla` | `web-flow` |

- A squash merge writes a new commit with a new author identity. Comparing a branch commit with the squash commit that
  replaced it shows `vldmr-mawla` against `vladimir-mawla` for the same work. That is a property of squash merging, not a
  discrepancy, and the comparison to make is branch commits with branch commits and `main` with `main`. For all 16 merged
  PRs, `gh api repos/vladimir-mawla/adaptive-agent/pulls/N` gives the same account, `vladimir-mawla`, as opener (`user.login`)
  and as merger (`merged_by.login`), so this data cannot show which of the two GitHub uses for the squash commit's author.
- `main` is not uniformly `vladimir-mawla`: 5 of its 21 commits resolve to `vldmr-mawla`, the genesis commits pushed
  directly. The commit email on those five, and on the 14 commits of PR #1, is `vladimir.mawla@aspiresoftware.com`; on the
  squash commits it is `105279249+vladimir-mawla@users.noreply.github.com`.
- The `author` field `gh pr list` reports is `vladimir-mawla` for all 17 PRs: the account that opened each one.
- **Trailers.** Over `main` and the heads of PRs #1 to #17 (`git fetch origin '+refs/pull/N/head:refs/prs/N'` for N = 1 to 17, then `git log origin/main origin/m3-evidence origin/mark-m2-done --glob='refs/prs/*' --format=%B | grep -i '^co-authored-by' | sort | uniq -c`; a plain `git log --remotes` in a fresh clone prints smaller numbers because the merged PR branches are deleted) the count was 172 of
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`, 31 of `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, 16 of
  `Co-authored-by: vladimir-mawla <vladimir.mawla@aspiresoftware.com>`, 14 of `Co-authored-by: Claude Opus 5 <noreply@anthropic.com>`,
  and one each of `Co-authored-by: Claude Sonnet 5.5`, `Co-authored-by: Claude Opus 5.5` and `Co-Authored-By: Claude Sonnet 5.5`
  (all `<noreply@anthropic.com>`), counted before this PR's commits existed. `.genesis/checkpoints/CURRENT.md` says the trailer is
  a fixed string the harness writes regardless of which model did the work, and must not be read as authorship
  evidence. This document draws no conclusion from it.

## 6. The deployment record

- ADR 0002 (M2): deployed at milestone 2; `vercel.json` pins `installCommand` to `npm ci` and `buildCommand` to
  `npm run build`; `/api/health` runs `assertFrozenCitesNoEvidence` in both directions and reports the deploy's commit.
- Observed with `curl -s https://adaptive-agent-gamma.vercel.app/api/health`: `commit` was `44e42b494ccc711e199c190c96cc91054a6a99d5`
  at 22:11:36 (the response's `date` header) and at 22:35:58, and `2879c13f3465ef2d8dd6cff502cae15b175b6852` at 22:37:52 and
  22:42:09. It changed between 1 m 39 s and 3 m 33 s after #17 merged (22:34:19). I did not check whether a Git
  integration or a manual deploy produced it.
- Statements that were true when written and are not now: the header of `docs/WALKTHROUGH.md` (corrected in this PR) and
  ADR 0008, Decision 7, with its last-but-two "does not claim" bullet ("Not a claim that the deployed URL reflects this
  milestone"). The ADR is left as written: `.genesis/**` is outside this PR's scope.
- A citation GitHub cannot resolve: ADR 0002 names `9fe1904` as the first of four deploy commits. `gh api
  repos/vladimir-mawla/adaptive-agent/commits/9fe1904` answers "No commit found for SHA", and no remote branch contains it. It
  exists in the local object database of the machine this was written on, with the subject "Pin Vercel install/build commands:
  npm ci, npm run build", which is also the subject of `9a23862`. The other three ADR 0002 names (`9a23862`, `ef3733f`,
  `81a9b82`) are commits of PR #3 and resolve. This document cites none of them.

## 7. The live walkthrough, driven for this milestone

In a browser against <https://adaptive-agent-gamma.vercel.app>, following the eleven actions of `docs/WALKTHROUGH.md`: eight
injections (a click in the context field, typing, a click on "Inject episode") and three dropdown changes, which were made
by setting the `<select>` value through the browser tool rather than by clicking. Run twice, from a fresh page load:

| Run | `/api/health` commit at the time | Finished (browser clock) |
|---|---|---|
| 1 | `44e42b4` (22:11:36) | about 22:23, after the spelling-drift check below |
| 2 | `2879c13` (22:42:09) | 22:42:31 |

Readings, identical in both runs (panel text read back from the page, not typed from the walkthrough):

1. Fresh load. `escalation-aggressiveness`: `TRIAL (pre-adoption)`, `HOLD — needs 3 more distinct context(s); tally: 0 distinct,
   helped=0 neutral=0 harmed=0`. `auto-refund-ceiling`: `TRIAL (pre-adoption)`, `FROZEN — invariant: inv-auto-refund-ceiling`,
   `0 trial episode(s), 0 monitoring episode(s) injected.`
2. `helped` for `tck-4471`, `tck-5002`, `tck-5108` against `escalation-aggressiveness`: `HOLD — needs 2 more … 1 distinct,
   helped=1`; `HOLD — needs 1 more … 2 distinct, helped=2`; then `LIVE (post-adoption monitoring)`, `ADOPT — tally: 3 distinct
   context(s), helped=3 neutral=0 harmed=0`, `3 trial episode(s), 0 monitoring episode(s) injected.`
3. Outcome `harmed`, `tck-6210`: `ADOPT — tally: 1 distinct context(s), helped=0 neutral=0 harmed=1`, `3 trial episode(s), 1
   monitoring episode(s) injected.`
4. `tck-6355`: `REVERT to 0.5 — tally: 2 distinct context(s), helped=0 neutral=0 harmed=2`, `3 trial episode(s), 2 monitoring
   episode(s) injected.`
5. Target `auto-refund-ceiling`, outcome `helped`, the same three tickets: after each, `TRIAL (pre-adoption)`, `FROZEN —
   invariant: inv-auto-refund-ceiling`, with counters `1`, `2`, then `3 trial episode(s), 0 monitoring episode(s) injected.`
   Final state of the three panels: `REVERT to 0.5 …harmed=2`; `response-directness` `HOLD — needs 3 more … 0 distinct`;
   `auto-refund-ceiling` `FROZEN` with 3 trial episodes.

What was read: in run 1, all three panels after each injection in beats 1 and 2, the `auto-refund-ceiling` panel after each
injection in beat 3, and all three at the end; in run 2, all three at the start, the `escalation-aggressiveness` panel after
each injection in beats 1 and 2, the `auto-refund-ceiling` panel after each in beat 3, and all three at the end.

**Spelling drift, run 1, after a reload (browser clock 22:23:23).** Target `response-directness`, outcome `helped`, `tck-9001`,
`TCK-9001`: `HOLD — needs 1 more distinct context(s); tally: 2 distinct, helped=2`; then ` tck-9001 ` (leading and trailing
space): `LIVE (post-adoption monitoring)`, `ADOPT — tally: 3 distinct context(s), helped=3 neutral=0 harmed=0`. Control, target
`escalation-aggressiveness`, `tck-1` typed identically three times: `HOLD — needs 2 more distinct context(s); tally: 1 distinct,
helped=3 neutral=0 harmed=0`. In the page's console, `'\u200b'.trim().length` was 1.

**Timing.** `say -r 150 -o narration.aiff -f narration.txt` on the 106-word narration of `docs/WALKTHROUGH.md`, then
`afinfo narration.aiff`, printed `estimated duration: 47.395737 sec`, agreeing with the walkthrough's 47.4 seconds. The
walkthrough itself says that figure depends on the rig.

## 8. Limits probe

The README's Limits refer to this block. Run from the repository root, exactly as written; it only reads the engine.

```bash
node --import ./scripts/register-ts-loader.mjs --input-type=module <<'EOF'
import { evaluateDelta } from "./domains/support-triage/scenario.js";
import { proposeDelta } from "./domains/support-triage/knobs.js";
import { SUPPORT_TRIAGE_REGISTRY } from "./domains/support-triage/invariants.js";
import { gate, createInvariantRegistry } from "./lib/invariants/gate.js";
import { contextId, behaviorDeltaId } from "./lib/contracts/ids.js";
import { timestamp } from "./lib/contracts/timestamp.js";
import { computeKnobView } from "./components/compute-demo-view.js";

const V = { kind: "vacant" };
const ep = (d, c, outcome, at = "2026-01-01T00:00:00Z") => ({ deltaId: d.id, contextId: contextId(c), outcome, observedAt: timestamp(at) });
const mk = (id, knob, from, to) => proposeDelta({ id, knob, from, to, proposedAt: "2026-01-01T00:00:00Z" });
const run = (delta, eps, prior = V) => { const r = evaluateDelta(delta, eps, prior); return r.ok ? r.decision : r; };
const line = (label, d) => console.log(label.padEnd(52), d.kind, d.tally ? `distinct=${d.tally.distinctContexts} helped=${d.tally.helped} neutral=${d.tally.neutral} harmed=${d.tally.harmed}` : "", d.revertedTo !== undefined ? `revertedTo=${d.revertedTo}` : "");

console.log("1. spelling drift: a === b / equal after NFC");
for (const [a, b, why] of [["ticket-42", "Ticket-42", "case"], ["ticket-42", "ticket-42 ", "whitespace"], ["ticket-42", "ticket-42\u200b", "zero-width"], ["caf\u00e9", "cafe\u0301", "NFC vs NFD"]]) console.log(" ", why.padEnd(12), a === b, a.normalize("NFC") === b.normalize("NFC"));
const dd = mk("p-drift", "response-directness", 0.4, 0.6);
line("  one ticket, 3 spellings incl. U+200B ->", run(dd, ["tck-9001", "TCK-9001", "tck-9001\u200b"].map((c) => ep(dd, c, "helped"))));
line("  contextIds '', ' ', U+200B ->", run(dd, ["", " ", "\u200b"].map((c) => ep(dd, c, "helped"))));

console.log("2. no value-range check (documented [0, 1], from 0.5)");
for (const to of [999999, -5, NaN, Infinity, 0.5]) { const d = mk("p-range-" + String(to), "escalation-aggressiveness", 0.5, to); line(`  to=${String(to)} + 3 distinct helped ->`, run(d, ["a", "b", "c"].map((c) => ep(d, c, "helped")))); }

console.log("3. arbitrate echoes whatever prior value the caller supplies");
const dr = mk("p-revert", "escalation-aggressiveness", 0.8, 0.95);
for (const replacedValue of [0.8, 0.5, 123456]) line(`  replacedValue=${replacedValue}, 2 distinct harmed ->`, run(dr, ["p", "q"].map((c) => ep(dr, c, "harmed")), { kind: "live", liveDeltaId: dr.id, replacedValue }));

console.log("4. raw-count majority, time, reporter");
const dv = mk("p-volume", "escalation-aggressiveness", 0.5, 0.8);
line("  1 ctx x5 helped + 2 ctx x1 neutral ->", run(dv, [...Array(5)].map(() => ep(dv, "loud", "helped")).concat([ep(dv, "n1", "neutral"), ep(dv, "n2", "neutral")])));
line("  observedAt: 2000, 'not-a-timestamp', 9999 ->", run(dv, [ep(dv, "a", "helped", "2000-01-01T00:00:00Z"), ep(dv, "b", "helped", "not-a-timestamp"), ep(dv, "c", "helped", "9999-12-31T23:59:59Z")]));

console.log("5. casts and freezing");
const refund = { id: behaviorDeltaId("p-refund"), knob: "auto-refund-ceiling", from: 500, to: 750, proposedAt: timestamp("2026-01-01T00:00:00Z") };
const bypassed = [...SUPPORT_TRIAGE_REGISTRY]; bypassed.splice(0, 1);
console.log("  gate on real registry:", gate(refund, SUPPORT_TRIAGE_REGISTRY), "| on a plain copy with the invariant spliced out:", gate(refund, bypassed));
const nested = createInvariantRegistry([{ id: "i", knob: "k", description: "d", extra: { n: 1 } }]); nested[0].extra.n = 99;
console.log("  element frozen:", Object.isFrozen(nested[0]), "| nested field after assignment:", nested[0].extra.n);
const hostile = new Proxy([], { get() { throw new Error("hostile"); } });
console.log("  protected knob + hostile episodes:", JSON.stringify(evaluateDelta(refund, hostile, V)));

console.log("6. revert is not sticky (demo view-model, escalation-aggressiveness)");
const seq = [..."123"].map((c) => ({ contextId: "t" + c, outcome: "helped" })).concat([..."12"].map((c) => ({ contextId: "m" + c, outcome: "harmed" })), [..."3456"].map((c) => ({ contextId: "m" + c, outcome: "helped" })));
console.log(" ", seq.map((_, i) => computeKnobView("escalation-aggressiveness", seq.slice(0, i + 1)).decision.kind).join(" -> "));
EOF
```

It printed (exit 0):

```text
1. spelling drift: a === b / equal after NFC
  case         false false
  whitespace   false false
  zero-width   false false
  NFC vs NFD   false true
  one ticket, 3 spellings incl. U+200B ->            adopt distinct=3 helped=3 neutral=0 harmed=0 
  contextIds '', ' ', U+200B ->                      adopt distinct=3 helped=3 neutral=0 harmed=0 
2. no value-range check (documented [0, 1], from 0.5)
  to=999999 + 3 distinct helped ->                   adopt distinct=3 helped=3 neutral=0 harmed=0 
  to=-5 + 3 distinct helped ->                       adopt distinct=3 helped=3 neutral=0 harmed=0 
  to=NaN + 3 distinct helped ->                      adopt distinct=3 helped=3 neutral=0 harmed=0 
  to=Infinity + 3 distinct helped ->                 adopt distinct=3 helped=3 neutral=0 harmed=0 
  to=0.5 + 3 distinct helped ->                      adopt distinct=3 helped=3 neutral=0 harmed=0 
3. arbitrate echoes whatever prior value the caller supplies
  replacedValue=0.8, 2 distinct harmed ->            revert distinct=2 helped=0 neutral=0 harmed=2 revertedTo=0.8
  replacedValue=0.5, 2 distinct harmed ->            revert distinct=2 helped=0 neutral=0 harmed=2 revertedTo=0.5
  replacedValue=123456, 2 distinct harmed ->         revert distinct=2 helped=0 neutral=0 harmed=2 revertedTo=123456
4. raw-count majority, time, reporter
  1 ctx x5 helped + 2 ctx x1 neutral ->              adopt distinct=3 helped=5 neutral=2 harmed=0 
  observedAt: 2000, 'not-a-timestamp', 9999 ->       adopt distinct=3 helped=3 neutral=0 harmed=0 
5. casts and freezing
  gate on real registry: frozen | on a plain copy with the invariant spliced out: eligible
  element frozen: true | nested field after assignment: 99
  protected knob + hostile episodes: {"ok":false,"reason":"lib/evidence.tally refused this episode set: hostile-episodes-input"}
6. revert is not sticky (demo view-model, escalation-aggressiveness)
  hold -> hold -> adopt -> adopt -> revert -> revert -> adopt -> adopt -> adopt
```

Read with care: block 2's last row, `to=0.5`, is a delta whose `to` equals its `from`. Block 1's last line passes the strings
`""`, `" "` and `"\u200b"` as three `contextId`s.

**Scratch-clone experiments.** Each was made in a clone of `44e42b4` (`2879c13` differs only in `package.json` and
`package-lock.json`), run, and discarded. None is committed.

| # | Edit | Result |
|---|---|---|
| A1 | in `gate()`, before the loop: `if (delta.knob === ("__attack_bypass__" as KnobId)) return "eligible";` | `npx vitest run`: 44 files, 384 tests passed; `npm run typecheck` exit 0 |
| A2 | in `gate()`, before the loop: `if (typeof delta.to === "number" && delta.to > 1_000_000) return "eligible";` | 44 files, 384 tests passed; `typecheck` exit 0; `evaluateDelta` on a hand-built `auto-refund-ceiling` delta with `to: 2_000_000` and three distinct helped contexts returned `{"kind":"adopt"}` |
| B | in `AdaptiveAgentDemo.tsx`, `handleInject`: `{ contextId: contextIdText, outcome }` → `{ contextId: contextIdText, outcome: "helped" }` | 44 files, 384 tests passed; `typecheck` exit 0. A first run, made while other builds were loading the machine, reported 2 failures I did not identify; the re-run on an otherwise idle machine passed all 384 |
| C | in `lib/contracts/adaptation-decision.ts`: `readonly tally?: never;` → `readonly tally?: EvidenceTally;` | `npm run typecheck`: `adaptation-decision.test.ts(36,5): error TS2578: Unused '@ts-expect-error' directive`, exit 1. `npx vitest run`: 1 failed, 383 passed: `tests/failures/15`'s dot-directory test, which runs `npm run typecheck` and expects exit 0 |
| D | add `\| { readonly kind: "bogus"; readonly deltaId: BehaviorDeltaId }` to `AdaptationDecision` | `tsc -p tsconfig.lib.json`: TS2345 at `scripts/demo-triage.ts(59,44)`. `tsc -p tsconfig.json`: TS2345 at `components/AdaptiveAgentDemo.tsx(57,44)`, TS2339 at `components/__tests__/compute-demo-view.test.ts(41,75)` and `(247,30)` |
| E | a scratch file with `sneaky satisfies AdaptationDecision`, a `JSON.parse(JSON.stringify(sneaky))` assignment and an `as unknown as AdaptationDecision` assignment | `TS1360` on the `satisfies` line only; the other two compiled |
| F | one `while :; do :; done` per CPU core while running `npx vitest run` | 1 failed, 383 passed: `compute-demo-view.test.ts` "10,000 synthetic helped episodes across 10,000 distinct contexts still resolves frozen", `Error: Test timed out in 5000ms` |
| G | `computeKnobView("auto-refund-ceiling", …)` with n distinct helped episodes, timed in Node | 1000: 23 ms; 2000: 60 ms; 4000: 241 ms; 8000: 1255 ms (one run each) |

Other commands run, with what they printed: `npm view typescript-eslint version peerDependencies` printed `8.72.0` and
`typescript: '>=4.8.4 <6.1.0'`. `npm audit --json` on the `next@16.3.5` lockfile, run before #17 merged: `critical: 1, high: 3, moderate: 2,
total: 6` by package, with 11 advisories under `next` (3 critical, 2 high, 5 moderate, 1 low). On `2879c13` at 22:36:26:
`high: 2, moderate: 2, total: 4`, none under `next`; `npm audit --omit=dev`: one package, `source-map-js` (high).

## 9. Statements in earlier documents that the repository does not support

1. **The genesis README** said "This is a genesis-only repository … no engine code" and listed `npm run lint # next lint`.
   By M8 the repository has an engine, and the script is `"lint": "eslint ."` in `package.json`. Rewritten in this PR.
2. **`docs/WALKTHROUGH.md`'s header** said the deployed URL "still serves the pre-M8 build (M7)". See section 6; corrected.
3. **ADR 0008, Decision 7**, on the same point. Left as written.
4. **`.genesis/DONE.html`** (locked) says the failure suite has "ten" cases. `ls tests/failures/*.test.ts | wc -l` prints 17.
5. **PR bodies #1 and #13** carry numbers superseded by later rounds (section 3).
6. **ADR 0002's `9fe1904`** (section 6).
7. **`.genesis/PLAN.md` §3, M9** names a drift guard, `app/milestones.test.ts`, and a 90-second Loom script. The guard does
   not exist and the recording has not been made; `docs/WALKTHROUGH.md` is the script.

## 10. The README's commands, run as written

In a fresh `git clone -b m9-deliverables` of this branch at `81fe180` (its `README.md` is the one from `45edbc7`, the last commit that touched it), on Node v24.7.0
and npm 11.5.1, each command from the README's code block, in its order, plus the other commands the README tells a reader to run:

| Command | Exit | What it printed |
|---|---|---|
| `npm ci` | 0 | |
| `npm run typecheck` | 0 | |
| `npm test` | 0 | `Test Files  44 passed (44)`, `Tests  384 passed (384)` |
| `npm run demo:triage` | 0 | nine steps; last line "All four AdaptationDecision kinds (adopt, hold, revert, frozen) were observed at least once. Demo complete." |
| `npm run dev` | — | `▲ Next.js 16.4.3 (webpack)`, `Local: http://localhost:3000`; `GET /` returned 200 and contained "Adaptive Agent — live demo"; `GET /api/health` returned `{"status":"ok","commit":"unknown (local dev)",…}`; stopped afterwards |
| `npm run build` | 0 | `▲ Next.js 16.4.3 (webpack)`, `✓ Compiled successfully` |
| `npm run lint` | 0 | nothing |
| `npm test -- failures` | 0 | `Test Files  17 passed (17)`, `Tests  45 passed (45)` |
| `npx eslint lib/arbitrate/arbitrate.ts` | 0 | `File ignored because of a matching ignore pattern` |

After `npm run build` and `npm run dev`, `git status --short` in that clone was empty.

## 11. What this PR changes

Files added or changed: `README.md`, `docs/ARCHITECTURE.md`, `docs/THESIS.md`, `docs/NOTES.md`, `docs/WALKTHROUGH.md`. The
frozen directories are untouched:

```bash
git diff origin/main -- lib domains tests components app scripts
```

prints nothing. `.genesis/DONE.html` is unchanged: this PR does not mark M9 done, and the independent verification and the
Loom recording are still to come.
