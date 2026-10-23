# Architecture: episodes → tally → the invariant gate → arbitrate → AdaptationDecision

This is a snapshot, not a file tour — each package documents itself in its own header comments, and
repeating that here would be a worse copy. What this document is for is the other half: **at each
stage, what does the engine refuse to do, and why.** Every refusal below is cited to a test by file and
title, quoted from the source, except where its bullet says otherwise. `npm test` on `main` at `2879c13` prints `Test Files  44 passed (44)` and
`Tests  384 passed (384)`. Anything that could not be traced to a test or to a command run for this
document is either marked as a reading of the source, or cut. The scratch experiments named below were run on
a clone of `44e42b4`; `2879c13` differs from it only in `package.json` and `package-lock.json`
(`git diff --stat 44e42b4 2879c13`).

**Two kinds of citation.** A title beginning `TYPE-LEVEL` is marked **[tsc]**. Its body is an
`@ts-expect-error`, so `vitest` passes it whatever the types say (esbuild erases them); what fails when
the refusal weakens is `npm run typecheck`, with `TS2578` (unused directive). Checked for real: in a
scratch clone, changing `frozen`'s `tally?: never` to `tally?: EvidenceTally` made `typecheck` fail at
`lib/contracts/__tests__/adaptation-decision.test.ts(36,5)`. Under `npm test` the only failure was
`tests/failures/15`'s dot-directory test, which shells out to `npm run typecheck` and expects exit 0 —
an indirect catch, not a contracts test noticing. A title is quoted in full unless it ends in `…`, which
marks a prefix.

**Import direction, checked, not assumed.** `grep -rhn --include='*.ts' --include='*.tsx' -E "^import|from \""
<dir> --exclude-dir=__tests__`, run for each package, resolves as follows:

| Package | Non-test imports resolve to |
|---|---|
| `lib/contracts` | itself only |
| `lib/evidence` | `lib/contracts` only |
| `lib/invariants` | `lib/contracts` only |
| `lib/arbitrate` | `lib/contracts`, `lib/invariants/gate.js` (the `InvariantRegistry` type), itself |
| `domains/support-triage` | `lib/contracts`, `lib/evidence`, `lib/invariants`, `lib/arbitrate`, itself |
| `components` | `domains/support-triage`, `lib/contracts`, `lib/arbitrate` (the `KnobPriorState` type), `react` |

So `lib/evidence` and `lib/invariants` are parallel siblings, not a chain: neither imports the other,
and nothing under `lib/` names `domains/`. **Only two of those edges are enforced by a test**:
`domains/support-triage/__tests__/architecture.test.ts` — "no non-test .ts file under lib/ contains an
import specifier naming domains/", and `lib/invariants/__tests__/architecture.test.ts` — "no non-test .ts
file under lib/invariants imports from ../evidence". The rest of the table holds today because of the
grep, which is a reading, not a regression guard.

```
 INPUTS             EVIDENCE            THE GATE              ARBITRATION                 THE RULING
 lib/contracts      lib/evidence        lib/invariants        lib/arbitrate               lib/contracts
 ─────────────      ────────────        ──────────────        ─────────────               ─────────────
 Episode[]      →   tally(deltaId,  →   gate(delta,       →   arbitrate(delta, tally, →   AdaptationDecision
 BehaviorDelta      episodes)           registry)             gateResult, priorState,     adopt · hold ·
 Invariant[]        TallyResult:        "eligible" |          registry)                    revert · frozen
   │                ok + tally, or      "frozen"                 │                           │
   ▼                a typed failure     (reads delta.knob        ▼                           ▼
 opaque id          (never a throw)     only)                 frozen first, else the     always cites its
 brands, closed                                               adopt bar (3 contexts)     tally — except
 outcome set                                                  or the revert bar          frozen, which
                                                              (2 contexts)               cites an invariant
```

Two honest wrinkles in that picture, stated rather than smoothed over. First, the arrows are a **call
sequence owned by the domain**, not an import chain: `evaluateDelta` in
`domains/support-triage/scenario.ts` calls `tally`, then `gate`, then `arbitrate` (lines 82–87), and
nothing in `lib/` sequences them. Second, because `tally` runs first, a hostile episode array attached to
the *protected* knob comes back as `{ ok: false, reason: "lib/evidence.tally refused this episode set:
hostile-episodes-input" }`, not as `frozen`. Run directly this session; no committed test pins that
combination (`tests/failures/05` drives the same call, but with an ordinary knob's delta). It fails
closed, so it is not a bypass, but "frozen from the first render" is a statement about well-formed input.

---

## Stage 1 — Inputs (`lib/contracts/**`)

**Job:** the closed vocabulary — `Episode` (`deltaId`, `contextId`, `outcome`, `observedAt`),
`BehaviorDelta` (`id`, `knob`, `from`, `to`, `proposedAt`), `Invariant` (`id`, `knob`, `description`),
`EvidenceTally`, and the four-variant `AdaptationDecision` — plus opaque string brands for ids.

**What it refuses, and why:**

- **Refuses a free-text or numeric `Episode.outcome`.** The outcome is one of `helped | neutral | harmed`,
  because a score would let one loud number stand in for corroboration. **[tsc]**
  *Tests:* `lib/contracts/__tests__/episode.test.ts` — "TYPE-LEVEL: a free-text outcome does not compile",
  "TYPE-LEVEL: a numeric outcome does not compile". The runtime twin of this refusal is in Stage 2.
- **Refuses a `BehaviorDelta` that does not state both `from` and `to`.** A delta that does not say what it
  changes *from* cannot be checked for direction. **[tsc]**
  *Tests:* `lib/contracts/__tests__/behavior-delta.test.ts` — "TYPE-LEVEL: missing `from` does not compile",
  "TYPE-LEVEL: missing `to` does not compile". What this does **not** do is check either value (see
  Stage 4, under the no-value-range-check limit).
- **Refuses a knob name outside a domain's closed set — but only once a domain narrows the generic
  parameter.** **[tsc]**
  *Tests:* `lib/contracts/__tests__/behavior-delta.test.ts` — "TYPE-LEVEL: a knob name outside the narrowed
  union does not compile"; `lib/contracts/__tests__/invariant.test.ts` — "TYPE-LEVEL: a knob name outside the
  narrowed union does not compile". **Disclosed limit, pinned by a passing test rather than left silent:**
  `behavior-delta.test.ts` — "HONEST LIMIT: the unparameterized default (KnobId = string) does NOT refuse
  free text — only a domain's own narrowed instantiation does"; `invariant.test.ts` — "HONEST LIMIT: the
  unparameterized default (KnobId = string) does NOT refuse free text".
- **Refuses to derive `distinctContexts` from the outcome counts.** It is its own stored field, because
  the two are allowed to diverge — 200 `helped` episodes from one context is `distinctContexts: 1` beside
  `helped: 200` (the cited test builds that literal; Stage 2 shows `tally` producing the divergence).
  *Test:* `lib/contracts/__tests__/evidence-tally.test.ts` — "constructs a tally where distinctContexts
  diverges from the sum of the three outcome counts".
- **Disclosed, not refused: ids have no grammar.** `contextId(raw)` in `lib/contracts/ids.ts` is `raw as
  ContextId`; nothing trims, folds case, strips zero-width characters or normalizes Unicode. That is the
  root of the spelling-drift limit in Stage 2.

## Stage 2 — Evidence (`lib/evidence/tally.ts`, `tally`)

**Job:** `tally(deltaId, episodes): TallyResult` — a pure count. `distinctContexts` is the size of a
`Set` of `contextId` strings (exact string equality), so repeating one context cannot add to it. The
signature differs from the plan's `tally(episodes): EvidenceTally` for two reasons recorded in ADR 0003:
a bare `EvidenceTally` has nowhere to put a failure, and a zero-episode delta has no episode to read a
`deltaId` from.

**What it refuses, and why:**

- **Refuses to let N episodes from one context count as N occasions.** This is the project's central
  refusal. *Tests:* `lib/evidence/__tests__/tally.test.ts` — "a replay storm of 50 episodes from a SINGLE
  context counts as ONE context, not fifty — the project's whole conceptual spine" (asserts
  `distinctContexts` is 1 while `helped` is 25 and `harmed` is 25), "500 episodes from a single context
  still counts as one context…", "50 episodes from ONE real context plus 2 episodes from 2 OTHER distinct
  contexts tallies to distinctContexts: 3…"; `tests/failures/01-same-context-replay-storm.test.ts` — "500
  identical-context 'helped' replays resolve hold, with distinctContexts: 1 and the full shortfall still
  outstanding", "scaling the SAME storm to 5,000 replays changes nothing about the count…", and the control
  "CONTROL, proving this is refused for lack of DISTINCT contexts specifically…". The mechanism was broken on
  purpose in a scratch clone at the M3 merge commit `8ccf08b` (`contexts.size` → `values.length`): 6 of 215
  tests failed, matching ADR 0003.
- **Refuses to let episode order change the answer.** *Tests:*
  `lib/evidence/__tests__/order-independence.test.ts` — "every one of the 5! = 120 orderings of a
  5-episode, 3-context scenario (including a repeated context) produces the identical EvidenceTally", "50
  identical-context episodes plus 2 genuinely distinct ones — every ordering still reports distinctContexts:
  3", and 150 seeded property scenarios (titles beginning `scenario seed=0` … `scenario seed=149`). Its generator
  draws `contextId` from a pool of three, so collisions happen; the test that checks this is "CONFIRMS THE
  GENERATOR CAN ACTUALLY PRODUCE THE CASE THAT MATTERS…".
- **Refuses to crash on a hostile array.** A `Proxy` or a throwing getter becomes a typed
  `hostile-episodes-input` failure. *Tests:* `lib/evidence/__tests__/hostile-input.test.ts` — "returns a typed
  hostile-episodes-input failure, not an uncaught exception", "a throwing contextId getter — the exact field
  the project's central refusal dedups on — returns the same typed failure, not a corrupted count…";
  `tests/failures/05-hostile-episode-array-fails-closed.test.ts` — "a Proxy that throws on every property
  access, passed straight into evaluateDelta, yields a typed { ok: false }, not a thrown error".
- **Refuses to re-read a field that can change between reads.** *Test:* `hostile-input.test.ts` — "a
  contextId getter that alternates between two values on successive reads cannot be used to make one episode
  silently count toward two different Set entries" (asserts `distinctContexts` is 1 and the getter was read
  once).
- **Refuses a malformed episode instead of coercing it.** A non-string field, an outcome outside the closed
  set, and another delta's episode each become a typed failure. *Tests:* `hostile-input.test.ts` — "a
  non-string contextId (e.g. a number, arriving via…", "an outcome that is a string but outside the closed
  helped|neutral|harmed set is refused as invalid-episode-outcome, never silently bucketed as harmed or
  dropped" (asserts `values: ["catastrophic"]`), "a numeric score standing in for outcome (plan §2's own named
  attack…"; `lib/evidence/__tests__/tally.test.ts` — "an episode whose own deltaId does not match the delta
  being tallied for is refused, not silently counted".
- **Refuses to let the failure report depend on array order.** *Test:* `hostile-input.test.ts` — "two
  different invalid outcome strings, in either order, produce the identical sorted error". The stated
  exception — `hostile-episodes-input` reports whichever exception the loop hits first — is in the header of
  `tally.ts`; no test pins it.
- **Refuses to treat no evidence yet as a failure, or to invent a sentinel for it.** *Test:*
  `tally.test.ts` — "an empty episode list tallies to all zeros for the given delta — a fresh, not-yet-evidenced
  delta is a legitimate call, not a failure".

**Disclosed limits, each pinned by a passing test:**

- **`contextId` spelling drift.** Case, whitespace, zero-width characters and NFC/NFD each make a distinct
  context. *Tests:* `tests/failures/06-context-id-spelling-drift.test.ts` — "confirms the five spellings are
  genuinely distinct JavaScript strings — this is not a test artifact, it is plain === semantics", "all five
  spellings of ONE real ticket, through the full pipeline, clear MIN_DISTINCT_CONTEXTS_ADOPT and resolve adopt
  — purely from spelling drift, no genuine corroboration" (asserts `adopt` with `distinctContexts` 5). It is
  also shown live; see the README.
- **No reporter identity.** *Test:* `tests/failures/07-reporter-identity-not-tracked.test.ts` — "five
  genuinely distinct, cleanly-spelled contextIds — all traceable to ONE real customer, by this scenario's own
  construction — resolve adopt".
- **No time decay.** `lib/evidence/tally.ts` contains no occurrence of `observedAt` (`grep -c observedAt
  lib/evidence/tally.ts` prints `0`). *Test:* `tests/failures/08-no-time-decay.test.ts` — "a delta
  corroborated by three episodes dated more than a year apart from each other adopts identically to one
  corroborated by three episodes minutes apart".

## Stage 3 — The invariant gate (`lib/invariants/gate.ts`, `gate`)

**Job:** `gate(delta, registry): "eligible" | "frozen"` — does any invariant in the registry name
`delta.knob`? Nothing else is consulted. `createInvariantRegistry` mints the only registry type `gate`
accepts: a defensive copy of the invariants, with the array and every element frozen separately.

**What it refuses, and why:**

- **Refuses to let evidence change its answer — by having no parameter to receive evidence.** Passing a
  third argument is a compile error, not an ignored value. **[tsc]** for that error; the same test also asserts
  `"frozen"` at runtime. *Test:*
  `lib/invariants/__tests__/gate.test.ts` — "STRUCTURAL PROOF: gate's own signature has no slot for evidence
  at all — passing a third argument is a compile error, not a runtime no-op". Empirically:
  `lib/invariants/__tests__/immunity.test.ts` — "10,000 'helped' episodes across 10,000 DISTINCT contexts still
  resolves 'frozen' for an invariant-protected knob" (asserts the real tally is `distinctContexts: 10_000`,
  `helped: 10_000`, then `gate` is `"frozen"`), the control "the same 10,000-episode tally against a
  NON-invariant-protected knob would have cleared any bar — confirming the storm itself is not the reason gate
  refuses", and "zero episodes also resolves 'frozen' for the same knob…".
- **Refuses to match on anything but the knob.** *Tests:* `gate.test.ts` — "matches purely on the knob string,
  ignoring which Invariant.id / description happen to be attached", "checks every invariant in a
  multi-invariant registry, not just the first".
- **Refuses a registry that can be mutated after construction.** *Tests:*
  `lib/invariants/__tests__/registry.test.ts` — "ATTACK: array-mutating methods
  (push/pop/shift/unshift/splice/sort/reverse/fill/copyWithin) — all throw", "ATTACK: index assignment on the
  returned reference — throws, value unchanged", "ATTACK: Object.defineProperty on the returned reference —
  throws for an existing index and for a new one", "ATTACK: reassigning a field on a returned ELEMENT (not the
  array) — throws, because elements are frozen independently". Mutating the caller's *own* original array
  afterwards is not refused — it is decoupled by the copy: "NOT AN ATTACK THIS FUNCTION STOPS, BY DESIGN —
  decoupling, not refusal…".
- **Refuses, by source scan, to mutate or import evidence.** *Tests:*
  `lib/invariants/__tests__/architecture.test.ts` — "contains no array-mutating-method call and no
  index-assignment expression in any non-test .ts file's code", "this milestone's own gate.ts legitimately uses
  .map to BUILD a fresh, then-frozen copy — confirming the scan does not false-positive on construction, only
  on mutation-in-place", "no non-test .ts file under lib/invariants imports from ../evidence".
- **How much those tests pin.** The gate was gutted to `return "eligible"` at the M4 merge commit `2ce7b8c`
  in a scratch clone: 7 of 237 tests failed and 230 passed, matching ADR 0004.

**Disclosed limits, each pinned by a passing test:**

- **A deliberate cast defeats the registry brand and the freeze.** *Tests:*
  `registry.test.ts` — "DISCLOSED RESIDUAL, NOT CLOSED BY THIS FUNCTION: a deliberate cast around a plain
  mutable array bypasses both the brand and the freeze entirely";
  `tests/failures/13-cast-residuals-bypass-type-brands.test.ts` — "createInvariantRegistry's brand and freeze
  are both erased at runtime by a deliberate cast around a plain array — removing an invariant from the
  bypassed copy makes the previously-protected knob eligible again", with the control "CONTROL, confirming this
  domain's own real, shipped registry is unaffected by this attack…". `gate` does not check that its registry
  was minted by `createInvariantRegistry`.
- **`Object.freeze` is one level deep.** True today only because `Invariant` is three primitive fields.
  *Tests:* `tests/failures/14-freeze-is-one-level-deep.test.ts` — "mutating a top-level string field on a frozen
  registry element throws (the control — the one-level freeze DOES work at this level)", "THE GAP: a
  cast-smuggled nested object-valued field on an Invariant survives createInvariantRegistry's freeze completely
  mutable, even though the element itself reports Object.isFrozen: true".

## Stage 4 — Arbitration (`lib/arbitrate/arbitrate.ts`, `arbitrate`)

**Job:** `arbitrate(delta, tally, gateResult, priorState, invariantRegistry): AdaptationDecision`. The plan
named four parameters; the fifth exists because `"frozen"` carries no `InvariantId` and `frozen` decisions
must cite one (ADR 0005, Decision 1). In order: it throws if `tally.deltaId !== delta.id`; if `gateResult`
is `"frozen"` it looks up the invariant and returns `frozen`, whatever the tally says; otherwise, with a
`vacant` prior state it applies the adopt bar (3 distinct contexts *and* `helped > neutral + harmed`),
with the delta itself live it applies the revert bar (2 distinct contexts *and* `harmed > helped +
neutral`), and with a different delta live it returns `hold`. The two thresholds are invented policy
constants (`lib/arbitrate/policy-constants.ts` says so); nothing in the repository derives them.

**What it refuses, and why:**

- **Refuses to adopt below `MIN_DISTINCT_CONTEXTS_ADOPT`, or without a helped-majority.** *Tests:*
  `lib/arbitrate/__tests__/arbitrate.test.ts` — "N = MIN_DISTINCT_CONTEXTS_ADOPT (3) with a helped-majority
  resolves 'adopt', citing the exact tally", "N = MIN_DISTINCT_CONTEXTS_ADOPT - 1 (2) with a helped-majority
  resolves 'hold', with distinctContextsNeeded: 1", "enough distinct contexts but NO helped-majority (tied)
  still resolves 'hold', not 'adopt' — the context count alone is not the whole bar", "a single context with
  an overwhelming episode count never reaches 'adopt' — distinctContexts, not episode volume, gates the bar".
- **Refuses to revert off one incident.** The revert bar is lower than the adopt bar, not zero. *Tests:*
  `arbitrate.test.ts` — "N = MIN_DISTINCT_CONTEXTS_REVERT (2) with a harmed-majority resolves 'revert', rolling
  back to the prior replaced value", "N = MIN_DISTINCT_CONTEXTS_REVERT - 1 (1) with a harmed episode resolves
  continued 'adopt', never 'revert' off a single post-adoption incident"; `tests/failures/03-single-incident-no-revert.test.ts`
  — "a 5,000-episode same-context harmed REPLAY STORM post-adoption still resolves continued adopt — one context
  is not enough no matter how many times it repeats", with the control "CONTROL, proving the bar is real and not
  merely 'always adopt continues'…".
- **Refuses to let the asymmetry be only two unequal constants.** *Tests:*
  `lib/arbitrate/__tests__/asymmetry.test.ts` — "MIN_DISTINCT_CONTEXTS_REVERT < MIN_DISTINCT_CONTEXTS_ADOPT (the
  asymmetry is real, not a naming coincidence)", and "distinctContexts === MIN_DISTINCT_CONTEXTS_REVERT clears
  the revert bar for a live delta, but the identical count, with a helped-majority instead, does NOT clear the
  adopt bar…" (asserts `revert` for the first, `hold` for the second).
- **Refuses two live deltas on one knob.** A rival is held even when its own evidence would adopt. *Tests:*
  `lib/arbitrate/__tests__/knob-contention.test.ts` — "a second delta with OVERWHELMING evidence of its own
  still resolves 'hold' while a different delta already lives on the same knob", "the SAME rival, once the knob
  is vacant again (the first delta reverted/superseded), is free to adopt on its own merits";
  `tests/failures/04-knob-contention-blocks-second-delta.test.ts` — "a rival delta with 50 distinct helped
  contexts (comfortably clearing MIN_DISTINCT_CONTEXTS_ADOPT) is still held while a DIFFERENT delta occupies the
  knob".
- **Refuses to let anything outrank `frozen`.** After the `tally.deltaId` consistency check, it is ruled on before
  the tally's counts or the prior state are read.
  *Tests:* `lib/arbitrate/__tests__/frozen-wins.test.ts` — "10,000 helped episodes across 10,000 distinct
  contexts, plus a vacant (adopt-eligible) prior state, still resolves 'frozen'", "the SAME 10,000-episode storm
  against a knob that is currently live for a DIFFERENT delta (which would otherwise force 'hold') still
  resolves 'frozen', not 'hold'…", "names the correct InvariantId from a multi-invariant registry, not merely
  the first entry"; `tests/failures/02-invariant-overwhelms-evidence.test.ts` — "10,000 distinct-context,
  all-helped episodes against the hand-built auto-refund-ceiling delta still resolve frozen, through the full
  evaluateDelta pipeline", with the control "CONTROL, proving frozen is not merely 'no evidence was attached'…".
- **Refuses to rule on another delta's evidence.** It throws rather than cite the wrong tally. *Tests:*
  `arbitrate.test.ts` — "throws when tally.deltaId does not match delta.id, under an 'eligible' gateResult",
  "throws on the SAME mismatch even when gateResult is 'frozen' — the check runs before the frozen branch even
  looks at the registry", "does NOT throw when tally.deltaId genuinely matches delta.id — the check is a real
  refusal, not a blanket throw".
- **Refuses to fabricate an `InvariantId`.** *Test:* `arbitrate.test.ts` — "throws if gateResult is 'frozen' but
  the supplied registry names no invariant on delta.knob". `grep -n "throw new Error"
  lib/arbitrate/arbitrate.ts` prints three sites (lines 174, 245, 255); two are caller-inducible. A caller must
  catch them; `arbitrate` has no typed failure value.
- **Refuses a `frozen` that cites evidence.** The result passes through `assertFrozenCitesNoEvidence`
  before it is returned. *Tests:* `lib/arbitrate/__tests__/architecture.test.ts` — "the call appears in
  arbitrate.ts's own non-test code"; `lib/arbitrate/__tests__/integrity.test.ts` — "throws, citing the integrity
  error, when the guard reports contamination" (the guard is mocked to fail, because `arbitrate`'s own fresh
  literal cannot contaminate itself), and "a FrozenDecision round-tripped through
  JSON.parse(JSON.stringify(...)), carrying a populated tally, is caught for real by the actual (non-mocked)
  guard" (asserts `ok` false, `field` `"tally"`). Also `lib/arbitrate/__tests__/architecture.test.ts` — "no 'as <Type>' cast expression appears in any
  non-test .ts file's code", a scan of `lib/arbitrate` only; `lib/evidence` and `lib/invariants` do contain casts.
- **Refuses an override-shaped parameter — by name.** *Test:* `lib/arbitrate/__tests__/architecture.test.ts` —
  "contains no occurrence of the substring 'override', case-insensitive, in any non-test .ts file's code". The
  same scan runs over `lib/contracts`. This pins a *word*, not the signature's arity: a fifth or sixth
  parameter named differently would not trip it. No test passes an extra argument to `arbitrate`.

**Disclosed limits, each pinned by a passing test:**

- **No value-range check at all.** Neither `gate` nor `arbitrate` reads `delta.from` or `delta.to` in code. A
  proposal to move a `[0, 1]` knob to 999,999 adopts on its first and only proposal. *Test:*
  `tests/failures/17-no-value-range-check-at-all.test.ts` — "escalation-aggressiveness (documented [0, 1])
  proposed from 0.5 to 999,999, with 3 genuine distinct helped contexts, adopts on its FIRST and ONLY
  proposal — no prior adoption, no history, no patience".
- **Cumulative drift is unchecked.** *Test:* `tests/failures/09-cumulative-drift-unchecked.test.ts` — "three
  sequential adopted deltas, each independently corroborated, walk escalation-aggressiveness from within [0, 1]
  to 3.4 — no step is refused, and nothing inspects the sequence".
- **`arbitrate` trusts the caller's prior value.** *Test:* `tests/failures/10-revert-trusts-caller-supplied-prior-value.test.ts`
  — "THE GAP: a buggy caller that hands back the ORIGINAL baseline (0.5) instead of the true immediate
  predecessor (0.8) gets that wrong value back, verbatim, with no error and no typed failure of any kind".
- **The majority is over raw episode counts, not contexts.** *Test:*
  `tests/failures/11-raw-count-majority-dominated-by-volume.test.ts` — "1 context reporting 1,000 helped
  episodes plus 2 DIFFERENT contexts each reporting one harmed episode resolves adopt — despite 2 of the 3
  distinct contexts actually saying harmed".
- **`hold.distinctContextsNeeded` is `0` for two different blockers.** *Test:*
  `tests/failures/12-hold-distinctContextsNeeded-is-zero.test.ts` — "ROUTE 2, THE GAP (majority-blocked): 5
  distinct contexts (well past the shortfall bar) but no helped-majority reports distinctContextsNeeded: 0 —
  indistinguishable, by this field alone, from 'no problem at all'", "ROUTE 3, THE GAP (contention-blocked): a
  rival delta with strong evidence is held with the SAME distinctContextsNeeded: 0 — the two 'reasons' are
  structurally indistinguishable from this field alone".
- **The knob-matching predicate is duplicated, and pinned textually, not behaviourally.** *Test:*
  `tests/failures/16-predicate-consistency-pin.test.ts` — "gate.ts's own predicate compares invariant.knob
  against delta.knob directly", "arbitrate.ts's ONE call site binds that parameter with delta.knob — the fact
  that makes the two predicates above the IDENTICAL comparison today". A guard clause inserted inside `gate()`
  passes all of them; see the README for what that did when run.

## Stage 5 — The ruling (`lib/contracts/adaptation-decision.ts`)

**Job:** the closed result. `adopt`, `hold` and `revert` each carry the `EvidenceTally` that licensed them;
`hold` also carries a number, `revert` the value it rolls back to; `frozen` carries the `InvariantId` that
forbade the change and no evidence at all.

**What it refuses, and why:**

- **Refuses to let a `frozen` decision carry `tally`, `distinctContextsNeeded` or `revertedTo`** — by fresh
  literal or by any of six non-literal routes. The fix declares all three as `?: never`, which moves the check
  from excess-property checking (literal sites only) to assignability against the value's static type, which holds at every site where that type still has the field (a value whose static type has dropped it is not caught; README, Limits item 5). **[tsc]** *Tests:*
  `lib/contracts/__tests__/adaptation-decision.test.ts` — "TYPE-LEVEL: a fresh frozen literal carrying a tally
  does not compile", "TYPE-LEVEL route 1/6 — intermediate binding does not compile", "TYPE-LEVEL route 2/6 —
  spread does not compile", "TYPE-LEVEL route 3/6 — function return does not compile", "TYPE-LEVEL route 4/6 —
  generic helper does not compile", "TYPE-LEVEL route 5/6 — Object.assign does not compile", "TYPE-LEVEL route
  6/6 — array element does not compile". ADR 0001 counts a seventh route, `x satisfies AdaptationDecision`;
  **no committed test pins it.** Re-run for this document in a scratch clone, it fails with `TS1360`, and the
  same file with `JSON.parse(JSON.stringify(x))` or `x as unknown as AdaptationDecision` produced no error.
- **Refuses a `hold` without a number, and an `adopt`/`revert` without a tally.** **[tsc]** *Tests:*
  `adaptation-decision.test.ts` — "TYPE-LEVEL: hold missing distinctContextsNeeded does not compile", "TYPE-LEVEL: hold with a boolean
  distinctContextsNeeded does not compile", "TYPE-LEVEL: adopt missing tally does not compile", "TYPE-LEVEL:
  revert missing tally does not compile", "TYPE-LEVEL: revert missing revertedTo does not compile".
- **Refuses, at runtime, a `frozen` value that reached the type by a cast, an `any`, or a supertype annotation, when `assertFrozenCitesNoEvidence` is called on it.**
  `assertFrozenCitesNoEvidence` checks presence, not provenance. Nothing in the shipped pipeline calls it on a value received from outside: `arbitrate` calls it on its own literal and `/api/health` on a synthetic one. *Tests:*
  `adaptation-decision.test.ts` — "catches a tally that
  arrived via the disclosed cast residual", "catches a distinctContextsNeeded that arrived via the disclosed
  cast residual", "catches a revertedTo that arrived via the disclosed cast residual".
- **Refuses to let a fifth variant go unhandled — at the call sites that switch on it.** There is no test for
  this on the real union (`lib/contracts/__tests__/adaptation-decision.test.ts` proves the mechanism on a local
  stand-in: "handles every stand-in case today (mechanism proven live during development, see comment above)").
  Run for this document in a scratch clone: adding `{ kind: "bogus"; deltaId }` to the union made
  `npm run typecheck` fail at `scripts/demo-triage.ts(59,44)` and `components/AdaptiveAgentDemo.tsx(57,44)` (the
  `default` arms calling `assertNeverAdaptationDecision`), and at two lines of
  `components/__tests__/compute-demo-view.test.ts`. No non-test file under `lib/` switches on the union: `grep -rn -E 'case "(adopt|hold|revert|frozen)"|\.kind === "(adopt|hold|revert|frozen)"|assertNever' lib --include='*.ts' --exclude-dir=__tests__` matches only the definition, the re-export and comments.
- **Disclosed, not refused: `adopt`, `hold` and `revert` can carry each other's stray fields.** *Tests:*
  `adaptation-decision.test.ts` — "adopt can still carry a stray invariant field via a non-literal route today", "hold can still carry a
  stray revertedTo field via a non-literal route today", "revert can still carry a stray distinctContextsNeeded
  field via a non-literal route today". Only `frozen` is named by the plan as needing to be unable to look
  evidence-driven.

## Stage 6 — The domain (`domains/support-triage/**`)

**Job:** one concrete set of knobs and the glue that composes the stages. `knobs.ts` declares
`AdaptableKnobId` (`escalation-aggressiveness`, `response-directness`) and `proposeDelta`; `invariants.ts`
declares `DomainKnobId` (those two plus `auto-refund-ceiling`), the one seeded `Invariant`, and a registry
built once through `createInvariantRegistry`; `scenario.ts` holds `evaluateDelta` and the fixtures.

**What it refuses, and why:**

- **Refuses to let `proposeDelta` name the protected knob.** Two layers: a type, and a scan of `knobs.ts`'s code.
  **[tsc]** for the first. *Tests:* `domains/support-triage/__tests__/knobs.test.ts` — "TYPE-LEVEL: proposeDelta
  refuses 'auto-refund-ceiling' as a knob name — it is not a member of AdaptableKnobId at all";
  `domains/support-triage/__tests__/architecture.test.ts` — "the CODE of knobs.ts (comments stripped) contains
  no occurrence of the substring 'auto-refund-ceiling'", with the control "invariants.ts IS the place that
  registers it in code — confirming the scan isn't vacuously passing because the string is banned everywhere".
  **Both layers are cosmetic against a deliberate cast.** What stops a cast-smuggled delta is the runtime
  comparison in `gate`: *Test:* `tests/failures/13-cast-residuals-bypass-type-brands.test.ts` — "a delta whose knob
  is built via runtime string concatenation, cast to AdaptableKnobId, bypassing knobs.ts's type guard and source
  scan, still resolves frozen when run through evaluateDelta".
- **Refuses to let the protected knob be the exception to the pipeline.** `evaluateDelta` has no branch on
  `delta.knob` (a reading of `scenario.ts`); the knob is frozen because `gate` says so. *Tests:*
  `domains/support-triage/__tests__/invariants.test.ts` — "SUPPORT_TRIAGE_INVARIANTS has exactly one entry,
  naming auto-refund-ceiling", "a delta hand-built to target auto-refund-ceiling is frozen — bypassing knobs.ts
  entirely"; `domains/support-triage/__tests__/scenario.test.ts` — "5 distinct-context, all-helped episodes (a
  pattern that clears the adopt bar for an adaptable knob) -> still frozen, identical decision" (asserts the two
  decisions are `toEqual`), and the control "FALSIFIABILITY: the same 5-episode evidence shape genuinely would
  adopt on an adaptable knob…".
- **Refuses to judge a revert on pre-adoption evidence.** Each phase has its own episode pool (ADR 0006,
  Decision 3); otherwise three `helped` trial episodes could outvote any number of later `harmed` ones that did
  not exceed them. `evaluateDelta` takes whatever pool it is handed, so the split is made by its caller; here
  that is `computeKnobView` in `components/compute-demo-view.ts`. *Tests:*
  `components/__tests__/compute-demo-view.test.ts` — "one post-adoption harmed episode is NOT enough to revert
  (asymmetric bar, but not zero); the tally is the monitoring pool's alone" (asserts the tally is
  `distinctContexts: 1, helped: 0, neutral: 0, harmed: 1` after three `helped` trial episodes and one `harmed`),
  "a SECOND distinct post-adoption harmed episode flips it to revert ON THE LAST EPISODE, rolling back to
  delta.from, citing the real 2-distinct / 2-harmed tally". A mutant that evaluates the live phase on the
  trial and monitoring pools together made 8 tests fail, all in `components/__tests__/`.
  `domains/support-triage/__tests__/scenario.test.ts` passes a monitoring pool it is already given, so it pins
  the revert bar, not the split. `arbitrate`'s signature accepts a cumulative pool and does not enforce this.
- **Refuses to hide the spelling-drift limit.** *Test:* `scenario.test.ts` — "three case/whitespace variants of
  ONE real ticket clear the same distinct-context bar a genuine three-ticket corroboration would" (asserts
  `adopt`, `distinctContexts` 3).

## Stage 7 — The surfaces

**`npm run demo:triage`** (`scripts/demo-triage.ts`) prints nine steps and asserts each decision with
`node:assert`; it exits non-zero unless all four decision kinds were observed. **No test
runs it** — the only mentions in test files are comments — so a regression in the script is caught only by
running it. Run for this document: exit 0, final line "All four AdaptationDecision kinds (adopt, hold,
revert, frozen) were observed at least once. Demo complete."

**The demo page** (`components/AdaptiveAgentDemo.tsx`, `components/compute-demo-view.ts`) holds the injected
history in `useState` and replays it through `evaluateDelta` on every render. What it refuses:

- **Refuses to display a decision the engine did not produce.** *Tests:*
  `components/__tests__/AdaptiveAgentDemo.test.tsx` — "hold: the real distinctContextsNeeded and all three counts
  (1 helped episode)", "revert: rolls back to THIS knob's own delta.from — 0.5 for escalation-aggressiveness",
  "frozen: cites this domain's own invariant id, and no tally at all"; and, for the protected knob,
  `components/__tests__/compute-demo-view.engine-spy.test.ts` — "10000 distinct helped episodes: evaluateDelta is
  called with a list growing 0..10000, ending in exactly those 10000 episodes in order…" — a pass-through spy on
  `evaluateDelta` and `arbitrate` (the title goes on to say `arbitrate` receives a 10000-distinct, 10000-helped
  tally on its last call and rules `frozen` on every call); `tally` and `gate` are not wrapped.
- **Refuses to special-case the protected knob's panel.** It is passed the same episodes as the others (ADR 0008,
  Decision 8, a disclosed deviation from the plan's wording). *Test:* the engine-spy file's "escalation-aggressiveness:
  tally 3/3/0/0, gateResult eligible, adopt. auto-refund-ceiling: the same counts, gateResult frozen, frozen".

**Disclosed, with what was run:**

- **The form's click wiring has no automated test.** In a scratch clone, replacing the `outcome` written by
  `handleInject` with the literal `"helped"` left all 384 tests passing and `typecheck` clean.
- **Revert is not sticky.** `computeKnobView("escalation-aggressiveness", …)` fed three helped, two harmed, then
  four more helped contexts returned `hold, hold, adopt, adopt, revert, revert, adopt, adopt, adopt` — two further
  helped contexts took a reverted knob back to `adopt`. ADR 0008, Decision 6 says so; no test pins it.
- **`/api/health` has no committed test.** It was exercised by running it (ADR 0002 records a break-and-revert
  proof) and was checked live for this document.

---

See [`THESIS.md`](THESIS.md) for the claim in under 300 words, [`NOTES.md`](NOTES.md) for how this was built and
checked milestone by milestone, [`WALKTHROUGH.md`](WALKTHROUGH.md) for the live demo script, and the
[README](../README.md) for the limits this pipeline does not close.
