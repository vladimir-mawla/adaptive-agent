# ADR 0003 — M3 evidence tallying: the signature deviation, the four typed failures, and what M3 does not claim

- **Date:** 2026-09-23
- **Status:** accepted
- **Phase / milestone:** M3 (BUILD) — `lib/evidence/`

## Context

`.genesis/PLAN.md` §3 (M3) commits this milestone to `tally(episodes: Episode[]): EvidenceTally` —
"pure, dedups by `contextId`, never by episode identity" — and to refusing "to crash on a hostile
`episodes` array (a throwing getter, a `Proxy`)... fails closed to a typed tally-failure value,
never an uncaught exception." This ADR records the shape actually shipped, why it differs from the
plan's literal text, and — per this account's own standing discipline against silently resolving an
ambiguous plan — the real gap the plan's own text leaves open here, matching the shape
`0001-contracts.md` already set for `KnobId`/`KnobValue`.

## Decision 1 — signature deviates from the plan's literal text: `tally(deltaId, episodes): TallyResult`, not `tally(episodes): EvidenceTally`

**The plan's own text pulls in two directions at once**, the identical shape `0001-contracts.md`
names for `AdaptationDecision.frozen` and the identical shape `agent-control-tower`'s own
`detectConflicts` resolved for its own M3: the plan's prose gives a one-argument signature returning
a bare `EvidenceTally`, but the SAME section's own "what it refuses" bullet requires a typed failure
value on hostile input — a bare `EvidenceTally` has no field to carry that. Checked directly, not
assumed: a scratch attempt at the literal one-argument signature confirmed there is no way to return
"tallying failed" without either throwing (refused directly by the plan) or inventing a sentinel
`EvidenceTally` value (e.g. all-zero counts) that would be indistinguishable from a genuine
zero-evidence tally — exactly the "silently wrong tally" this milestone's own task refuses.

**The fix:** `tally` returns `TallyResult` (`{ ok: true; tally: EvidenceTally } | { ok: false; error:
TallyFailure }`) — re-derived independently in `lib/evidence/tally.ts` rather than imported from
`lib/contracts` or from `agent-control-tower`'s `DetectionResult`, because `lib/contracts/**` is
FROZEN (this milestone must not add a new export to it) and the two repos do not share code across a
repo boundary.

**A second, independent reason the signature also gains an explicit `deltaId` parameter, not named in
the plan's prose at all:** `EvidenceTally.deltaId` (`lib/contracts/evidence-tally.ts`, M1, FROZEN) is
a required field. An `episodes`-only signature has no honest way to populate it in two real cases
this milestone must support: (a) a brand-new `BehaviorDelta` with **zero** episodes yet — a
legitimate, common, non-hostile call (M5's `arbitrate`, unbuilt, must be able to ask "what's the
tally for this delta so far" the moment a delta is proposed, before any episode exists, and get back
`distinctContexts: 0`, not a refusal) — supplies no episode to read a `deltaId` from at all; (b) a
non-empty array could still be hostile or simply wrong, and inferring `deltaId` from `episodes[0]`
would mean trusting the very input this milestone's own task says to distrust. Taking `deltaId` as an
explicit parameter closes both: it makes the empty-episodes case ordinary (not a special case
requiring a fabricated identity), and — see Decision 3 — it gives `tally` something to check every
episode's own `deltaId` against, catching a caller that accidentally hands it another delta's
episodes, which an `episodes`-only signature could never detect at all, structurally.

**Final shape, exactly as shipped:**

```ts
export function tally(deltaId: BehaviorDeltaId, episodes: readonly Episode[]): TallyResult
```

## Decision 2 — the dedup mechanism: `Set<ContextId>.size`, proven order-independent two ways, and proven able to actually collide

`distinctContexts` is computed as `new Set(episodes.map(e => e.contextId)).size` (inlined as a
single accumulating `Set` in the implementation, not a two-pass map-then-count, for the same
single-pass-no-second-source-of-truth reason `evidence-tally.ts`'s own header names for why
`distinctContexts` is a plain stored field rather than a derived property). This is what makes the
project's central refusal — "a replay storm of 50 episodes from a single context must count as one
context, not fifty" — hold **by construction**, not by a separate dedup step bolted on afterward: a
`Set`'s membership cannot depend on how many times the same value was inserted or in what order.

**Proven, not just asserted, three ways** (`lib/evidence/__tests__/`):

1. `tally.test.ts` — a direct 50-episode and a 500-episode single-context storm, each asserted to
   report `distinctContexts: 1`, with the episode-level `helped`/`neutral`/`harmed` counts checked
   separately to confirm those are NOT collapsed (only `distinctContexts` dedups — the plan is
   explicit these two numbers are allowed to diverge, on purpose).
2. `order-independence.test.ts` — an exhaustive 5-episode, 3-context, 5! = 120-permutation sweep
   (not sampled), including a 50-episode storm shuffled 200 times, all producing the identical
   `TallyResult`.
3. `order-independence.test.ts` — a property-based sweep of 150 randomly generated episode sets
   (`fixtures.ts`'s `randomEpisode`), each checked against 5 independent random shuffles, using a
   seeded `mulberry32` PRNG so any failure is reproducible from its printed scenario seed.

**The generator's pool size is the load-bearing design choice in (3), not an incidental detail** —
this milestone's own task names the exact failure mode to avoid: "a 300-scenario property test that
was structurally incapable of generating the one case that turned out exploitable... because every
id was derived from fields that are always distinct." `randomEpisode` draws `contextId` from a pool
of only **three** values, not a fresh id per call, so with more than 3 episodes per scenario (the
generator draws 1–12), most scenarios contain a genuine `contextId` collision by construction. This
is checked directly, not assumed: `order-independence.test.ts`'s own final test asserts, over the
same 150 scenarios the order-independence sweep already ran, that at least one scenario produced
`distinctContexts < episodes.length` (a real collision occurred) AND at least one produced
`distinctContexts > 1` (the generator doesn't collapse everything to one context either) — so this
suite's passing is not vacuous in either direction.

## Decision 3 — three further typed failures found necessary, beyond the plan's own named "hostile array" case, all serving "never a silently wrong tally"

The plan's own prose names one hostile-input shape ("a throwing getter, a `Proxy`"). Building the
function honestly surfaced three further ways a value could reach `tally` already past every
compile-time check `lib/contracts` provides — via an unsafe cast (the exact residual
`0001-contracts.md` Decision 1 already discloses for `AdaptationDecision`, or an implicit `any` from
a library call such as `JSON.parse`) — without the extraction step itself throwing at all. Each is
checked, not assumed, and each has its own `hostile-input.test.ts` case:

- **`invalid-episode-shape`** — a safely-read `deltaId`/`contextId`/`outcome` is not even the right
  runtime type (e.g. a `contextId: 12345`, or an `outcome: 0.9` — the exact "numeric score standing
  in for it" the plan names as refused for `Episode.outcome` itself). Silently `String()`-coercing
  such a value, or treating a non-string as if it were a legitimate context, would produce a
  plausible-looking but fabricated tally. Reports every offending field, deduped and sorted — proven
  to report **both** fields when two are wrong on the same episode, not just the first found.
- **`invalid-episode-outcome`** — a string-typed `outcome` outside the closed
  `"helped" | "neutral" | "harmed"` set `episode.ts` itself declares closed. Falling through a
  switch's default arm into whichever bucket happens to be last (this implementation uses an
  if/else-if/else chain, so this failure is checked and returned *before* that chain ever runs, not
  merely hoped to be unreachable by construction) would misrepresent the tally's own counts.
- **`mismatched-delta-episode`** — an episode's own `deltaId` does not match the `deltaId` the call is
  tallying for (see Decision 1). Counting it anyway would silently attribute one delta's evidence to
  a different one.

**All three failure kinds collect the full SET of offenders (deduped, sorted), not "whichever came
first"** — proven directly: `hostile-input.test.ts`'s last case constructs two differently-invalid
outcome strings and asserts both orderings of the two-element array produce the identical sorted
error. This is deliberately stronger than what the plan's own falsifiability check asks for (which
names only the happy-path permutation sweep) — extending order-independence to the failure path too,
because a failure report that silently varies by array order would itself be a "silently wrong"
result, just not a wrong *count*.

**The one exception, disclosed rather than silently left for a reader to find:** `hostile-episodes-
input` (a throwing getter or a `Proxy` trap on the array itself) reports whichever exception the
underlying `for...of` loop hits first, because catching it necessarily halts iteration before any
later element is even reached. This is the identical, already-disclosed limit
`agent-control-tower`'s own `detect-conflicts.ts` header names for the same class of check — not
re-litigated here, just inherited and stated plainly.

## Decision 4 — a mutating/re-entrant accessor is read exactly once per field, never re-read

A hostile `Episode` could expose a getter that returns a *different* value on successive reads (not
merely one that throws). If `tally` ever read the same field twice — once to build a `Set` key and
again to build the returned tally, for instance — a single episode could be made to contaminate the
count with two different `contextId`s. `safeExtract` reads `deltaId`/`contextId`/`outcome` into a
plain `RawEpisodeFields` object exactly once per episode, and every later step (shape validation,
outcome validation, delta-match validation, counting) operates only on that already-captured plain
value, never on the original `Episode` again. Proven directly:
`hostile-input.test.ts`'s "mutating accessor" case constructs a `contextId` getter that alternates
between two values on successive calls and asserts both that the resulting tally reports exactly one
context (the FIRST read, captured once) and that the getter was invoked exactly once, not twice.

## Falsifiability — run for real, not just described

1. **The central dedup mechanism** (`Set<ContextId>.size`) was replaced with `values.length` (a
   minimal, uncompensated one-line sabotage — no call-site change, no compensating filter added
   elsewhere) and the full suite (`npm test`) was re-run: 6 of 215 tests failed, all and only the
   ones that exercise dedup directly — the 50- and 500-episode single-context storm tests, the
   50-plus-2-distinct test, the 120-permutation exhaustive sweep, the 50-storm shuffle sweep, and the
   generator's own "can this actually collide" sanity check. All other 209 tests, including every
   hostile-input and shape-validation test, stayed green, confirming this sabotage's blast radius was
   isolated to the mechanism it actually broke, not silently masked by an unrelated compensating
   check. The file was then restored **byte-for-byte** (`diff` against the pre-sabotage copy returned
   no output) and the suite returned to 215/215.
2. **The fail-closed mechanism** (the `try`/`catch` in `safeExtract`) was removed entirely (comment
   left in place noting it was a temporary sabotage) and the suite was re-run: exactly 4 tests failed
   — the `Proxy`-array test and the three throwing-getter tests (`deltaId`/`contextId`/`outcome`),
   each now reporting an actual uncaught `Error` thrown out of `tally` itself rather than a typed
   `TallyResult`, confirmed directly in the failure output (`expected [Function] to not throw... but
   'Error: hostile getter: deltaId' was thrown`). All 211 other tests stayed green. The file was
   restored byte-for-byte and the suite returned to 215/215.

## What this milestone does not claim

- **No source-diversity distinction, only `contextId` distinctness** — one customer opening five
  different tickets about the same underlying complaint (five distinct `contextId`s) tallies
  identically to five different customers each opening one. This is the plan's own §4 failure-suite
  case 6, explicitly named there as "disclosed, not fixed" and deferred to M7 (unbuilt) — `tally`
  itself has no notion of "reporter identity" distinct from "context" and this milestone does not
  invent one.
- **No time-weighting or decay** — `tally` never reads `observedAt` for anything but the value's own
  presence (validated the same as any other field would be, if it were read — it isn't). This is the
  plan's own §4 failure-suite case 7, a deliberate, disclosed non-goal, not an oversight.
- **`invalid-episode-shape`/`invalid-episode-outcome`/`mismatched-delta-episode` detect a value that
  reached `tally` already malformed — they do not, and cannot, verify that a forged-but-well-formed
  value (a syntactically valid string `contextId` that does not correspond to any real context) is
  genuine.** This is the same honest, narrow scope `0001-contracts.md`'s `assertFrozenCitesNoEvidence`
  already discloses for itself: presence/shape checking, not provenance checking.
- **`hostile-episodes-input`'s reported message is not claimed to be order-independent when the input
  contains more than one hostile element** — see Decision 3's disclosed exception.
- This milestone builds no gating and no arbitration — `tally` consults no `Invariant`, no policy
  constant, and no prior adoption state. Whether a given `EvidenceTally` clears any bar is entirely
  M4/M5's job (both unbuilt); this file only counts.
