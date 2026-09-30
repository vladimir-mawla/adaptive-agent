# ADR 0007 — M7 the failure suite: which sketched cases survived, which were extended past redundancy, the limits nobody had written down, and what this milestone does not claim

- **Date:** 2026-09-30
- **Status:** accepted
- **Phase / milestone:** M7 (BUILD) — `tests/failures/**`

## Context

`.genesis/PLAN.md` §3 (M7) commits this milestone to pinning real limits, not happy paths, each
traced to a design decision already made in M1–M6 — never invented fresh at M7. §4 sketches
roughly ten cases and warns directly that one or more may describe a mechanism that does not
actually exist once M1–M6 are built, the way a prior sibling project's own M7 sketch named a
"future-dated heartbeat failing closed" that turned out not to exist in the shipped code. `lib/**`
and `domains/**` are FROZEN for this milestone; this ADR records what was found, replaced, and
added, and why, per this account's own standing discipline (`0001`–`0006-*.md`) of disclosing a
real gap rather than silently resolving it.

## Finding 1 — the sketch's own ten cases were mostly real, but four of the "PROVES a refusal" cases were already pinned, in whole or in part, by M3–M6's own test suites — not invalid, but not novel either

Before writing anything, every case in `.genesis/PLAN.md` §4 was checked against the shipped
`lib/**`/`domains/**` test suites (not assumed from the plan's own prose):

- Case 1 (same-context replay storm) — already proven at `lib/evidence`'s own unit level
  (`__tests__/tally.test.ts`'s 50/500-episode storms) AND at the full-pipeline level
  (`domains/support-triage/__tests__/scenario.test.ts`'s own "FALSIFIABILITY: a same-context replay
  storm never reaches adopt" test, at n=50).
- Case 2 (invariant beats overwhelming evidence) — already proven at `lib/invariants`'s own unit
  level (`__tests__/immunity.test.ts`, 10,000 episodes) AND at the full-pipeline level
  (`scenario.test.ts`'s `auto-refund-ceiling` tests, at n=5).
- Case 3 (no revert off one incident) — already proven at `lib/arbitrate`'s own unit level
  (`__tests__/arbitrate.test.ts`/`asymmetry.test.ts`) AND at the full-pipeline level
  (`scenario.test.ts`, at n=1).
- Case 4 (two deltas racing one knob) — already proven at `lib/arbitrate`'s own unit level
  (`__tests__/knob-contention.test.ts`) AND at the full-pipeline level (`scenario.test.ts`'s "a
  different delta already live" test).

**This was not treated as a reason to skip these four cases.** `.genesis/PLAN.md` §3 (M7) commits
this milestone to its OWN directory (`tests/failures/**`) with its OWN discipline (a file header
stating plainly whether each case proves a refusal or discloses a gap) — a property the M3–M6
suites, real and correct as they are, do not carry, and `.genesis/DONE.html`'s own M7 gate names
`tests/failures/**` specifically, not "any test anywhere that happens to cover the same ground."
Re-running an already-proven refusal through this milestone's own dedicated suite is not padding;
it is this milestone doing its own job. **What WAS done to keep these four cases from being pure
duplication:** each is re-proven through the full `evaluateDelta` pipeline (not reaching into
`arbitrate`/`gate` directly with synthetic fixtures, the way `lib/arbitrate`'s own tests do) AND at
materially larger scale or broader coverage than the existing suites already exercise — case 1 at
5,000 replays (not 50) plus a genuinely-distinct-context control; case 2 at the full 10,000-episode
scale through `evaluateDelta` (immunity.test.ts only exercises `gate()` alone at that scale); case
3 with a 5,000-episode harmed replay storm post-adoption (not merely n=1) on a second knob; case 4
with a rival delta built via `proposeDelta`, not a hand-rolled fixture. Case 10 (malformed delta
bypassing normal proposal flow) was folded into case 2's own file rather than given a separate one,
since `REFUND_CEILING_DELTA` (this domain's own scenario fixture) already IS exactly that
construction, and a separate file would only restate the same evidence shape under a different
name.

## Finding 2 — no sketched case was invalid or described a non-existent mechanism; none were dropped

Unlike the plan's own caution (and unlike at least one prior sibling project's M7, which found a
sketched mechanism that did not exist), every one of this project's own ten sketched cases traces to
a real, shipped refusal or a real, disclosed gap. **Nothing was dropped for being unfounded.** Two
were *refined* rather than replaced outright, recorded here as findings in their own right:

- **Case 9 (revert's rollback target across more than one adoption), taken at the plan's own
  literal wording, would have been a regression test wearing a failure's clothes.** "Construct two
  sequential adoptions and revert the second, landing on the first adopted value, not the original
  baseline" is exactly what happens when the CALLER correctly tracks and supplies
  `priorState.replacedValue` — `arbitrate.ts`'s own `revert` branch does no computation at all
  (`revertedTo: priorState.replacedValue`, read straight off the input). Testing only the
  caller-gets-it-right path would pass because the system does the one thing asked of it, not
  because any refusal is exercised — precisely the trap this milestone's own brief warns against.
  `tests/failures/10-revert-trusts-caller-supplied-prior-value.test.ts` keeps the correct-caller
  scenario as an explicit CONTROL and adds the real, previously-disclosed-but-never-tested limit
  `.genesis/decisions/0005-arbitration.md` Decision 3 already names in prose: `arbitrate` has no
  adoption history of its own and cannot tell a correct "immediately prior value" from a caller bug
  that reports a wrong one (e.g. the original baseline, skipping an intermediate adoption) — both
  produce an equally confident `revertedTo`, with nothing distinguishing them.
- **Case 6 (source-diversity / reporter identity), taken at the plan's own literal wording, collided
  with a DIFFERENT, more concrete gap `.genesis/decisions/0003-evidence.md` had already found and
  named "a different, more dangerous gap than the one above" during M3.** The plan's own case 6 is
  about one REPORTER opening several genuinely distinct tickets; M3's own ADR separately discloses
  that the SAME ticket, spelled inconsistently (case, whitespace, a zero-width character, Unicode
  normalization form), also clears the same bar — a structurally different mechanism the plan's own
  §4 sketch does not mention by name at all, despite this account's own brief naming it "the
  strongest candidate in the list." Both are real and both are kept as SEPARATE cases
  (`tests/failures/06-context-id-spelling-drift.test.ts` for the spelling-drift gap,
  `tests/failures/07-reporter-identity-not-tracked.test.ts` for the plan's own original case 6),
  rather than folding the stronger, ADR-sourced gap into the weaker-worded plan sketch and losing
  the distinction between them.

## Finding 3 — limits nobody had written down before this milestone

Two cases pin behavior that no ADR, plan section, or existing test suite had previously turned into
a persisted, committed, runnable proof:

- **`tests/failures/13-cast-residuals-bypass-type-brands.test.ts`, part (a):**
  `.genesis/decisions/0006-domain.md`'s own "Decision 1, continued" records that L4 VERIFY, during
  M6's own review, manually smuggled a cast-built `"auto-refund-ceiling"` knob name past
  `knobs.ts`'s type guard and source scan and ran it through the real pipeline, observing `frozen`.
  That finding was recorded in prose only — no committed test anywhere in this repository exercises
  it. This milestone turns it into a real, running, committed test.
- **`tests/failures/13-cast-residuals-bypass-type-brands.test.ts`, part (b):** `lib/invariants/
  gate.ts`'s own header and `.genesis/decisions/0004-gate.md`'s own attack table both disclose that
  a cast around a plain array bypasses `InvariantRegistry`'s brand and freeze entirely, and
  `lib/invariants/__tests__/registry.test.ts` already proves the bypassed array does not throw when
  pushed to. **No existing test demonstrates the actual CONSEQUENCE** — this milestone's own test
  goes one step further: splicing the one seeded invariant OUT of a bypassed, unfrozen registry
  copy and confirming `gate()` now reports a previously-protected knob `"eligible"`, the concrete
  shape of the disclosed residual actually mattering, not merely "a mutation didn't throw."

Both are disclosed elsewhere in prose (ADRs, source-file headers) but had never been proven to
hold, or fail to hold, by running code — this milestone closes that specific documentation/test gap
without touching any FROZEN source.

## Finding 4 — the full "richest source" list from this milestone's own brief, each pinned, verified rather than copied

Every disclosed limit named in this milestone's own brief was independently re-verified against the
actual shipped code (not copied from the ADR's own prose) before being turned into a test:

| Limit | Verified how | Pinned in |
|---|---|---|
| `contextId` spelling drift | `node -e` against all four mechanisms directly (see helpers.ts's own header) | `06-context-id-spelling-drift.test.ts` |
| `hold.distinctContextsNeeded === 0` | Read `arbitrate.ts`'s own `distinctContextsShortfall` and both call sites that produce `hold` | `12-hold-distinctContextsNeeded-is-zero.test.ts` |
| Raw-count majority dominated by volume | Read `EvidenceTally`'s own shape (M1, FROZEN) and `helpedMajority`'s raw-count definition | `11-raw-count-majority-dominated-by-volume.test.ts` |
| Duplicated `invariant.knob === delta.knob` predicate | Read both `gate.ts`'s internal loop and `arbitrate.ts`'s `findInvariantForKnob` side by side, confirmed textually separate, not imported; pinned (not falsified) per Round 2 below | `16-predicate-consistency-pin.test.ts` |
| Cast residuals (`AdaptableKnobId`, `InvariantRegistry`) | Reproduced both casts directly against the real, shipped source | `13-cast-residuals-bypass-type-brands.test.ts` |
| `Object.freeze` one level deep | Confirmed `Invariant`'s three fields are all primitives today, then simulated the disclosed future case via a cast | `14-freeze-is-one-level-deep.test.ts` |
| No cumulative-drift tracking | Walked a real three-step adoption sequence through `evaluateDelta` | `09-cumulative-drift-unchecked.test.ts` |
| `eslint.config.mjs` ignores `.ts`/`.tsx` | Read the config file directly, then ran a real, deliberately broken `.ts` fixture through both `npm run lint` and `npm run typecheck` | `15-eslint-config-ignores-typescript.test.ts` |

**The duplicated-predicate coupling risk is pinned, not falsified — see Round 2 below for why that
distinction matters and how the pin was built**: `lib/arbitrate/arbitrate.ts`'s own
`findInvariantForKnob` re-implements `gate.ts`'s internal `invariant.knob === delta.knob` predicate
as a textually separate loop (`.genesis/decisions/0005-arbitration.md` Decision 1 already names
this). The two are identical TODAY, and `16-predicate-consistency-pin.test.ts` now asserts exactly
that, structurally, from both files' own source — but nothing currently forces them to stay
identical from within this milestone's own scope, and reproducing an actual drift between them
would require editing `gate.ts` itself (FROZEN) to introduce a different matching rule, which is out
of this milestone's authority. What IS proven, already, by `lib/arbitrate/__tests__/
arbitrate.test.ts`'s own "an inconsistent gateResult/invariantRegistry pair is refused loudly" test:
the one place an actual drift would surface (a `gateResult` that no longer matches what the registry
itself says) fails loud rather than silently misreporting. This milestone does not re-prove that
existing test; it defers to it rather than duplicating it.

## Falsifiability — which cases were proven by making them fail, for real, and restored byte-for-byte

Per this milestone's own bar ("prove the most important ones by making them fail"), the four
highest-value PROVES cases were each falsified against the REAL, shipped `lib/**` source — not a
synthetic stand-in — with the sabotage always minimal, always uncompensated, and always reverted
before any commit:

1. **`lib/evidence/tally.ts`'s `distinctContexts: contexts.size` → `distinctContexts: values.length`**
   (the identical sabotage `0003-evidence.md`'s own falsifiability log already ran for `lib/
   evidence`'s own suite, re-run here against THIS milestone's cases): `tests/failures/
   01-same-context-replay-storm.test.ts` failed 2 of 3 (the genuinely-distinct-context control
   correctly stayed green — it has 3 contexts and 3 episodes, so `values.length` and
   `contexts.size` coincide), and `tests/failures/11-raw-count-majority-dominated-by-volume.test.ts`
   failed 1 of 2 (`distinctContexts` reported 1002, not 3). Restored byte-for-byte
   (`diff` against a pre-sabotage backup returned no output).
2. **`lib/invariants/gate.ts`'s `gate` gutted to return `"eligible"` unconditionally** (matching
   `0004-gate.md`'s own Experiment 1 exactly): `tests/failures/
   02-invariant-overwhelms-evidence.test.ts` failed 2 of 3, and `tests/failures/
   13-cast-residuals-bypass-type-brands.test.ts` failed 2 of 3 (both its PROVES sub-case and its
   DISCLOSES sub-case, since both ultimately call the same `gate`). Restored byte-for-byte.
3. **`lib/arbitrate/arbitrate.ts`'s knob-contention branch condition
   (`priorState.liveDeltaId === delta.id`) replaced with an unconditional `true`** (minimal,
   uncompensated — no call-site change): `tests/failures/
   04-knob-contention-blocks-second-delta.test.ts` failed 1 of 2, and `tests/failures/
   12-hold-distinctContextsNeeded-is-zero.test.ts` failed its own route-3 (contention) case while
   routes 1 and 2 correctly stayed green (they never touch the sabotaged branch). Restored
   byte-for-byte.

After each experiment, `diff` against a pre-sabotage backup confirmed a byte-for-byte restore, and
`git status --short`/`git diff main -- lib domains app` were confirmed empty before any commit in
this milestone — no FROZEN file was ever committed in a broken state at any point.

## Round 2 — L4 VERIFY findings, each fixed for real, not merely acknowledged

L4 VERIFY approved this milestone's overall shape (no case judged padding, all three Round-1
sabotage experiments reproduced exactly, both sketch refinements upheld) and found three concrete
issues. All three are fixed in this branch's own history below, not deferred to a future milestone.

**1. Case 15's typecheck claim was false — caught, reproduced, and fixed.** The original scratch
fixture lived under a dot-prefixed directory (`tests/failures/.scratch-case-15/`). `tsc`'s own
directory-crawling behavior for an `include` glob (`tsconfig.lib.json`'s `"tests/**/*.ts"`) silently
SKIPS any dot-prefixed directory — confirmed directly, twice: generically (a fresh dot-directory
with an undeclared-identifier fixture, `tsc` exits 0) and against the exact original scratch path.
`npm run typecheck` genuinely never saw the broken file, so "rejected by `npm run typecheck`" was
never true as originally written, and was shipped without ever being checked against a real `tsc`
run. **The fix:** the fixture now lives under a non-dot-prefixed scratch directory
(`tests/failures/scratch-case-15/`), confirmed directly to make `tsc` report `TS2304` naming the
undeclared identifier and exit non-zero. The dot-directory skip is kept as its own, separate,
disclosed gotcha (a dedicated test in the same file), since a reader relying on a hidden scratch
directory to keep `tsc`'s own crawl out would be fooled the identical way this milestone briefly
was.

**2. The predicate-drift deferral was incompletely reasoned — a pinning test was available without
touching frozen code, and this ADR previously did not engage with that option.** `tests/failures/
16-predicate-consistency-pin.test.ts` is that pin: it asserts, by reading `gate.ts`'s and
`arbitrate.ts`'s own source directly, that (a) `gate.ts`'s predicate compares `invariant.knob`
against `delta.knob`; (b) `arbitrate.ts`'s `findInvariantForKnob` predicate compares `invariant.knob`
against its own parameter; (c) that parameter is bound, at arbitrate's one call site, to `delta.knob`
— together proving the two predicates reduce to the identical comparison TODAY, without editing
either FROZEN file. **Falsified for real, twice, against the real shipped source:** `gate.ts`'s
predicate was temporarily changed to `invariant.knob.toLowerCase() === delta.knob` and the pin's
first assertion failed exactly as predicted; separately, `arbitrate.ts`'s call site was temporarily
changed to pass `delta.knob as KnobId` and the pin's third assertion failed exactly as predicted.
Both were restored byte-for-byte before any commit. This turns "we could not falsify the drift" into
"we could, separately, pin that no drift has happened yet" — the distinction L4 VERIFY's brief named
directly.

**3. A real limit none of the original 15 cases pinned, and the strongest finding in the round-2
review: there is no value-range check on a knob's own value AT ALL, not only across a sequence.**
L4 VERIFY ran `proposeDelta({ knob: "escalation-aggressiveness", from: 0.5, to: 999999 })` plus 3
genuine distinct helped-context episodes through the real pipeline and got `adopt`, immediately,
first try — no drift, no history, no sequence of any kind required. Case 9 (cumulative drift) had
framed the unchecked-bound gap as requiring an accumulated SEQUENCE of small, individually-
corroborated steps; that framing, read on its own, undersells the root cause and could leave a
reader believing patience is required. It is not. **The fix:** `tests/failures/
17-no-value-range-check-at-all.test.ts` pins the single-step root cause directly (on both adaptable
knobs, both an absurdly large and a negative out-of-range value), and case 9's own header is revised
to point at case 17 as the deeper, simpler cause it is one manifestation of, rather than standing
alone as if sequence were the requirement.

## What this milestone does not claim

- **This milestone does not claim to have found every limit in this system** — only the ones named
  in its own brief, the ten from the plan's own sketch (refined where the literal wording would have
  produced a regression test), two found by independently re-deriving and testing prose an existing
  ADR/source header already disclosed but never turned into a running proof, and one (case 17) found
  by L4 VERIFY during its own independent review of this branch.
- **The duplicated-predicate coupling risk (`0005-arbitration.md` Decision 1) is now pinned (Round
  2, item 2), but still not independently FALSIFIED** — reproducing an actual drift between the two
  predicates would require editing FROZEN `lib/invariants/gate.ts` to introduce a different matching
  rule, out of this milestone's authority. What this milestone confirms instead: the pin is real
  (falsified twice against the real source and restored, see Round 2), and the one place an actual
  drift would surface at runtime (an inconsistent `gateResult`/registry pair) is already covered by
  `lib/arbitrate`'s own existing test.
- **Case 6 (spelling drift) and case 7 (reporter identity) are each disclosed, not solved** — no
  code change accompanies either; `lib/evidence`/`lib/contracts` remain exactly as FROZEN as they
  were before this milestone, per this milestone's own scope (pin limits, do not fix them).
- **Case 9 (cumulative drift) and case 17 (no value-range check at all) do not attempt to bound or
  validate a knob's value** — both demonstrate the gap is reachable through the real pipeline,
  matching the plan's own statement that building real cumulative-bound tracking is out of this
  project's M3–M5 budget, and therefore out of M7's authority to retrofit; case 17 does not attempt
  even the narrower, single-value bound check its own existence might otherwise suggest is easy to
  add.
- **This milestone adds no code under `lib/**`/`domains/**`/`app/**`** — confirmed directly,
  `git diff main -- lib domains app` is empty throughout this milestone's own history, not merely
  at the final commit.
