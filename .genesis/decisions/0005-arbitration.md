# ADR 0005 — M5 arbitration: the fifth parameter, the asymmetric bars, the honest limit on `hold`, and what M5 does not claim

- **Date:** 2026-09-30
- **Status:** accepted
- **Phase / milestone:** M5 (BUILD) — `lib/arbitrate/`

## Context

`.genesis/PLAN.md` §3 (M5) commits this milestone to `arbitrate(delta, tally, gateResult,
priorState): AdaptationDecision` — "combines the gate's verdict, the evidence tally, and prior state
into an `AdaptationDecision`," enforcing the adopt/revert asymmetry, one live delta per knob, and
`frozen` beating everything. `lib/contracts/**` (M1), `lib/evidence/**` (M3), and `lib/invariants/**`
(M4) are all FROZEN inputs to this milestone. `.genesis/decisions/0001-contracts.md` additionally
records a BUILD REQUIREMENT for this milestone: `arbitrate` must call
`assertFrozenCitesNoEvidence` on any `frozen` decision it returns, and refuse to trust one that
fails it. This ADR records the shape actually shipped, why it differs from the plan's literal
4-parameter text, and — per this account's own standing discipline against silently resolving an
ambiguous plan (`0001-contracts.md`, `0003-evidence.md`, `0004-gate.md`) — a real gap this
milestone found in the plan's own signature, plus an honest limit this milestone inherits from a
frozen contract shape it is not permitted to change.

## Decision 1 — signature deviates from the plan's literal text: a fifth parameter, `invariantRegistry`, is required to populate `frozen.invariant` at all

**The gap, found by trying to implement the plan's literal 4-parameter signature, not guessed at
in advance:** `gateResult` is exactly `lib/invariants/gate.ts`'s own return type (M4, FROZEN),
`"eligible" | "frozen"` — a bare two-value string carrying no information about WHICH `Invariant`
matched when it says `"frozen"`. But `AdaptationDecision`'s `frozen` variant (M1, FROZEN)
*requires* `invariant: InvariantId`. Given only `delta`, `tally`, `gateResult`, and `priorState`,
there is no honest value to put in that field — inventing one (e.g. a placeholder string, or
`delta.knob` reused as if it were an `InvariantId`) would misrepresent which invariant actually
fired, precisely the kind of dishonesty this project's own discipline refuses elsewhere (M1's
`frozen`-citing-evidence refusal; M4's refusal to fabricate a `gate` verdict). This is the same
class of finding M1 made in `KnobId`/`KnobValue`, M2 made in an unreachable function name, M3 made
in `tally`'s missing failure slot, and M4 made in its own task brief's wrong directory — flagged
here, not silently patched around.

**The fix:** `arbitrate` takes a fifth parameter, `invariantRegistry: InvariantRegistry<KnobId>` —
the exact same registry a caller already had to construct and pass to `gate(delta, registry)` in
order to *produce* the `gateResult` this function receives in the first place. No caller is asked
for a new capability; every legitimate caller of `arbitrate` already holds this value, because
there is no way to have obtained a real `gateResult` without it. When `gateResult === "frozen"`,
`arbitrate` re-reads the registry with the identical `invariant.knob === delta.knob` predicate
`gate` itself uses internally — the SAME matching rule, re-derived rather than imported (`gate`
does not expose its internal loop), not a second, divergent one.

**Why `gateResult` itself is still trusted as the single source of truth for frozen-ness, rather
than recomputing it by calling `gate(delta, invariantRegistry)` internally:** plan §2's "`frozen`
wins over everything" refusal is meant to rest on one authoritative verdict, computed once
upstream and threaded through every layer that acts on it — the same reason `priorState` is taken
as an input rather than derived here from a full adoption history this function does not own (see
Decision 3). `invariantRegistry` in this signature is used *only* to name a verdict already
decided, never to re-decide it.

**What happens if a caller passes an inconsistent pair — `gateResult: "frozen"` together with a
registry that names no invariant on `delta.knob`:** `arbitrate` throws, rather than fabricate an
`InvariantId`. No correct caller can produce this pair (the registry used to *compute* that
`gateResult` necessarily contains a match), so this is a contract violation on the caller's part,
not a decision this function's closed four-variant output type has any honest way to represent —
the same "fail loud on 'should never happen', don't silently misreport" standard
`assertNeverAdaptationDecision` already sets for an unhandled variant. Proven directly:
`__tests__/arbitrate.test.ts`'s "an inconsistent gateResult/invariantRegistry pair is refused
loudly" test constructs exactly this pair against an empty registry and confirms the throw, with
the message, not merely that *something* threw.

## Decision 2 — the adopt/revert asymmetry: two independent knobs (distinct-context floor, majority direction), proven to actually change the output at identical input shapes

Plan §1/§3 name the asymmetry as deliberate: reverting a change that is hurting should be easier
than adopting one, because a slow revert costs more (continued harm) than a slow adopt (one more
distinct context of waiting). This is built as two policy constants
(`lib/arbitrate/policy-constants.ts`): `MIN_DISTINCT_CONTEXTS_ADOPT = 3`,
`MIN_DISTINCT_CONTEXTS_REVERT = 2` — both disclosed, invented, no researched basis claimed, exactly
as plan §3 itself states them.

**"Majority" is defined the same way in both directions, just aimed at a different outcome column**
— `helpedMajority(tally) = tally.helped > tally.neutral + tally.harmed` for adopt,
`harmedMajority(tally) = tally.harmed > tally.helped + tally.neutral` for revert — a true majority
over all three counted outcomes, not merely a plurality over the opposing column alone.

**The asymmetry is proven as an OUTPUT difference, not merely as two unequal constants sitting
next to each other:** `__tests__/asymmetry.test.ts` builds the identical `distinctContexts` count
(`MIN_DISTINCT_CONTEXTS_REVERT`, i.e. 2) with a clean majority in each function's own favored
direction, and confirms the SAME count of distinct contexts yields `revert` for an already-live
delta but only `hold` for a not-yet-adopted candidate with the mirrored (helped) majority — the
asymmetry is falsifiable at the exact boundary where it would stop being true if the two constants
were ever made equal, not merely asserted by comparing the constants to each other.

**The floor is real, not merely lower:** `__tests__/arbitrate.test.ts` and
`__tests__/asymmetry.test.ts` both separately confirm a single post-adoption `harmed` episode
(`distinctContexts: 1`) never reverts on its own — matching plan §2's own refusal, "to revert off a
single post-adoption `harmed` episode... the revert bar is lower than the adopt bar, but it is not
zero" — and that a same-context harmed replay storm of 5,000 episodes, still `distinctContexts: 1`,
is likewise refused (the identical M3 dedup discipline this milestone inherits, now proven at the
revert side too, not only the adopt side `__tests__/frozen-wins.test.ts`/M4's own `immunity.test.ts`
already covered).

## Decision 3 — `KnobPriorState`: what this function needs to know about ONE knob, not a system-wide adoption history

Plan §4's own failure case 8 ("cumulative drift... is not checked") and case 9 ("revert's rollback
target when more than one delta has adopted since baseline") both concern adoption HISTORY — a
sequence of deltas over time for one knob. Building `arbitrate` to walk that sequence itself would
be a materially bigger engine than this milestone's own scope (plan §4 names this explicitly:
"building real cumulative-bound tracking is a materially bigger engine than a hackathon M3–M5
budget supports"). Instead, `KnobPriorState<KnobValue>` carries exactly the two facts this ONE
ruling needs about THIS delta's own knob, computed by whatever owns adoption history (M6's domain,
unbuilt): `{ kind: "vacant" }` (no delta is currently live on this knob) or `{ kind: "live";
liveDeltaId; replacedValue }` (some delta is live; if it is `delta` itself, `replacedValue` is the
value immediately prior to `delta`'s OWN adoption — case 9's "immediately prior, not original
baseline" requirement is satisfied by making this the caller's own obligation to track and hand
back correctly, not something `arbitrate` re-derives from a history it is never given). This keeps
`arbitrate` a pure, one-shot ruling function over its five inputs, matching the plan's own framing
of this milestone as "the ruling layer," not a history-tracking one.

**This does not solve failure case 8 (cumulative drift) — it was never this milestone's job to.**
Nothing in `KnobPriorState` or in `arbitrate`'s own logic inspects how far a knob's live value has
already walked from any original baseline; each call only ever compares the CURRENT candidate's own
tally against the current gate result and the current knob occupancy. This is named here, again,
as a disclosed, unsolved limit — not rediscovered as a surprise by a later milestone.

## Decision 4 — "at most one live delta per knob," enforced deterministically regardless of the rival's own evidence

When `priorState.kind === "live"` and `priorState.liveDeltaId !== delta.id`, `arbitrate` returns
`hold` for `delta` unconditionally — its own tally is not even consulted for this branch beyond
being cited on the returned decision. `__tests__/knob-contention.test.ts` proves this with a rival
candidate whose own tally, taken alone, would clear the adopt bar outright (50 distinct contexts,
all helped) — confirming the only thing stopping adoption is the contention rule, not weak
evidence, matching plan §3's own falsifiable check ("a test asserting a second delta targeting an
already-adopted knob returns `hold`, never a silent second `adopt`").

## Decision 5 — the honest limit this milestone inherits from `AdaptationDecision.hold`'s frozen shape, and why it is disclosed rather than worked around

**The gap, found while implementing, not assumed:** `AdaptationDecision.hold` (M1, FROZEN) carries
exactly one number, `distinctContextsNeeded` — no field for *why* a hold fired beyond a
distinct-context shortfall. `arbitrate` produces `hold` for three structurally different reasons:

1. not enough distinct contexts yet (the number is meaningful: literally how many more are needed);
2. enough distinct contexts, but no helped-majority (the number is honestly `0` — no more contexts
   are needed for THAT half of the bar — while the real blocker is the majority condition);
3. blocked by a rival live delta on the same knob (Decision 4) — the number reflects only the
   distinct-context shortfall toward the ADOPT bar, which may itself already be `0`, while the real
   blocker is occupancy, not evidence at all.

Plan §3's own prose promises a second candidate is rejected "via `hold`, with a stated reason" —
but the frozen `AdaptationDecision.hold` shape has no field to carry that reason in the RETURNED
VALUE itself. `lib/contracts/**` is FROZEN; this milestone is not permitted to add a field to
`hold`, and per this milestone's own instructions, a frozen contract's own shape being insufficient
for a plan requirement is a finding to report, not a gap to route around with an invented wrapper
type or a cast. **This milestone does not invent a new exported `ArbitrationResult`/reason type to
paper over it** — no consumer exists yet (M6/M8 are both unbuilt) to name a concrete need for one,
and inventing speculative structure nobody has asked for yet is exactly the kind of scope creep this
account's own standing discipline warns against. The "stated reason" plan §3 promises exists today
only as: (a) which of `arbitrate`'s own source branches produced the `hold` (readable in
`arbitrate.ts` itself, and pinned by name in this milestone's own tests — see
`__tests__/arbitrate.test.ts`'s "HONEST LIMIT" test and `__tests__/knob-contention.test.ts`), and
(b) this ADR. A future milestone that needs to DISTINGUISH these three reasons at the call site
(M6 or M8, if the demo UI ever needs to show a different message for "blocked by a rival" versus
"needs one more ticket") will need either a contracts change (out of this milestone's authority)
or a richer wrapper return type built at that point, against a real, named consumer — not
speculatively here.

## Decision 6 — construction sites need no cast, proven by source scan, not merely by the absence of a compile error — CORRECTED, A PRIOR DRAFT OF THIS DECISION OVERCLAIMED

**The overclaim, found by L4 VERIFY, stated plainly rather than restated more gently:** an earlier
draft of this Decision said "none [of `arbitrate`'s returned literals] is built through an
intermediate binding, a spread, or a generic helper." That is false as written:
`buildFrozenDecision` does exactly this —

```ts
const decision: FrozenDecision = { kind: "frozen", deltaId, invariant };
const integrity = assertFrozenCitesNoEvidence(decision);
...
return decision;
```

`const decision: FrozenDecision = { ... }` *is* an intermediate binding — the object literal is
not constructed directly at the `return` site, it is assigned to a named variable first (so that
`assertFrozenCitesNoEvidence` has something to inspect before the function returns), and that
variable is what `return` actually hands back. Recorded here at the correct strength rather than
restated a second time still too strongly, per this account's own standing note that a disclosed
limit stated *more* strongly than it holds is its own defect, not a smaller version of the same
mistake as understating one.

**Why this binding is still safe — the mechanism, not a blanket claim about "no bindings":** M1's
actual incident (`0001-contracts.md` Decision 1) was that TypeScript's *excess-property check*
applies only to a fresh object literal written directly at an assignment/argument/array-element
site — an intermediate binding lets a stray evidence-shaped field slip through *that specific
check* undetected. M1's fix was not "forbid intermediate bindings" — no such rule would be
enforceable or is even asked for — it was to declare `tally`/`distinctContextsNeeded`/`revertedTo`
as `tally?: never` on `FrozenDecision`, which moves the check from excess-property-checking
(literal-site-only) to *ordinary assignability*, checked at **every** site a value is given that
type, binding or not. `const decision: FrozenDecision = { kind: "frozen", deltaId, invariant }` is
still a *fresh object literal*, at its OWN declaration site, checked against an explicit
`FrozenDecision` annotation — assignability is enforced right there, the moment the binding is
created, not deferred past it. A stray `tally`/`distinctContextsNeeded`/`revertedTo` field on this
literal would fail to compile at this exact line (an `@ts-expect-error`-style proof of this would
be redundant with M1's own tests, which already prove `FrozenDecision` itself refuses these fields
at every site — this file does not re-prove a claim `lib/contracts` already owns). What actually
stays true, restated once at the strength that survives: every `AdaptationDecision` value
`arbitrate` returns — `adopt`, `hold`, `revert`, and `frozen` (via the one intermediate binding in
`buildFrozenDecision`) — is a **fresh object literal assigned at its own declaration or return
site**, never a reused variable of a looser type, never built via a spread, and never built via a
generic helper (the actual non-literal shapes M1's own incident exploited, per `0001-contracts.md`'s
seven reported routes) — not "never through any binding at all," which was the false, broader claim.

`__tests__/architecture.test.ts` proves the resulting "no cast is needed" claim by SOURCE SCAN (a
compile-time absence of errors would not distinguish "no cast was needed" from "a cast was written
and happened to compile," since a cast always compiles by design) — confirmed to actually fire by
temporarily inserting a real `as unknown as` cast and re-running the scan (see this milestone's PR
report for the falsifiability log). That proof is unaffected by this correction: the scan checks
for `as`, not for the absence of intermediate bindings, and `buildFrozenDecision`'s own binding
never needed one.

## Decision 7 — `assertFrozenCitesNoEvidence` is called, and is load-bearing, proven two ways

The BUILD REQUIREMENT `0001-contracts.md` records is honoured: `buildFrozenDecision` calls
`assertFrozenCitesNoEvidence` on every `frozen` decision before returning it, and throws if the
check fails, rather than trusting or silently forwarding a contaminated value.
`__tests__/architecture.test.ts` confirms the call is actually present in the shipped source (not
merely imported and never invoked); `__tests__/integrity.test.ts` separately confirms the call is
*behaviorally* load-bearing by mocking `assertFrozenCitesNoEvidence` to report a forced failure and
confirming `arbitrate` throws, citing the integrity error — the one case this milestone's own
clean, cast-free construction sites (Decision 6) can never trigger unassisted, since they never
build a `frozen` value carrying a populated evidence field to begin with. Both are necessary: the
source scan alone cannot prove the call's *result* is honoured (a call whose result is ignored
would also pass a presence-only scan); the mock-based test alone cannot prove the call was not
quietly deleted from a future edit that still happens to pass every behavioral test today.

## Decision 8 — the interaction between the distinct-context gate and a raw-count majority check, disclosed, not silently left for a reader to find

`EvidenceTally` (M1, FROZEN) carries `helped`/`neutral`/`harmed` as plain per-EPISODE counts, not
per-distinct-context counts — there is no way, from `EvidenceTally` alone, to know how many of the
`distinctContexts` contributed a `helped` episode versus a `harmed` one. This means a delta can
clear `distinctContexts >= 3` from, say, one dominant context contributing thousands of `helped`
episodes plus two contexts each contributing a single `harmed` episode, and still register a
"helped-majority" by raw count even though a majority of the DISTINCT CONTEXTS actually said
`harmed`. This is a real, disclosed gap adjacent to — but distinct from — plan §4's own failure
case 6 (source-diversity / reporter-identity is not checked): case 6 is about one REPORTER opening
many distinct tickets; this is about the raw-count majority check itself not being computed
per-context. `arbitrate`'s signature (`tally: EvidenceTally`, not `episodes: Episode[]`) has no
access to a per-context outcome breakdown to check this more precisely even if it wanted to —
`lib/evidence/tally.ts` (M3, FROZEN) does not expose one. This is pinned as a passing, honestly
labeled test in `__tests__/arbitrate.test.ts` ("enough distinct contexts but NO helped-majority...")
demonstrating the STRICTER of the two checks still refuses in the boundary case actually tested,
alongside this disclosure that a more adversarial per-context skew is not, and structurally cannot
be, checked by this function against the frozen `EvidenceTally` shape alone.

## Falsifiability, run for real at every step above, not just described once

1. **Full gut** (`arbitrate`'s body replaced with an unconditional `return { kind: "adopt", ... }`,
   minimal, uncompensated — no call-site changes, no compensating check added elsewhere), full
   suite (`npm test`) re-run: **253 of 266 tests still passed**, decomposed, not reported alone:
   - **237** are M1–M4's own tests (pre-existing, untouched by this milestone), which never call
     `arbitrate` and could not have detected this regardless of what it does.
   - **16** of this milestone's own 29 tests call `arbitrate` but themselves expect `"adopt"` and so
     pass trivially against a constant-`"adopt"` function, by design, not by a blind spot (every
     "resolves adopt"/"continued adopt"/"free to adopt" case across `arbitrate.test.ts`,
     `asymmetry.test.ts`, and `knob-contention.test.ts`). 237 + 16 = 253, matching the passing count.
   - **The remaining 13 all failed, correctly**: every test asserting `"hold"`, `"revert"`,
     `"frozen"`, or the inconsistent-registry throw — 6 in `arbitrate.test.ts`, 1 in
     `asymmetry.test.ts`, 4 in `frozen-wins.test.ts`, 1 in `integrity.test.ts`, 1 in
     `knob-contention.test.ts`. 253 + 13 = 266, the full suite size — the arithmetic closes.
   The file was restored byte-for-byte (`diff` against the pre-sabotage backup returned no output)
   and the suite returned to 266/266.
2. **`assertFrozenCitesNoEvidence`'s call replaced with a hardcoded `{ ok: true }`** (minimal,
   uncompensated): exactly 2 of 266 tests failed — the source-scan assertion in
   `architecture.test.ts` and the mocked-failure assertion in `integrity.test.ts` — confirming both
   proofs are real, not merely each other's shadow. Restored byte-for-byte; suite returned to
   266/266.
3. **A real `as unknown as` cast inserted into `arbitrate.ts`** (minimal, uncompensated): exactly 1
   of 266 tests failed — the no-cast scan in `architecture.test.ts`, by name and line number.
   Restored byte-for-byte; suite returned to 266/266; `npm run typecheck` stayed clean throughout
   (the cast itself compiles fine, by design — it is the source scan, not `tsc`, that catches it).

## What this milestone does not claim

- **The plan's own "stated reason" for a contention-blocked `hold` is not represented in the
  RETURNED `AdaptationDecision` value** — only in this ADR and in `arbitrate.ts`'s own source
  structure (Decision 5). This is a disclosed consequence of a frozen contract shape, not something
  this milestone invented a workaround for.
- **Cumulative drift across sequentially adopted deltas on one knob (plan §4 failure case 8) is not
  checked here** — `KnobPriorState` carries only the immediately relevant fact about one knob's
  current occupant, never a full history (Decision 3).
- **The raw-count majority check can be dominated by one context's episode volume relative to
  others' (Decision 8)** — a real, disclosed gap distinct from, though adjacent to, plan §4's own
  failure case 6, and not closeable from `arbitrate`'s own signature without a richer
  `EvidenceTally` shape that `lib/evidence` (FROZEN) does not provide.
- **This milestone builds no domain and no UI.** `arbitrate` consults no ticket, customer, or
  render logic — it is a pure ruling over five already-computed inputs, matching plan §3's own M5
  scope line. Whether a concrete domain (M6, unbuilt) correctly computes and threads
  `KnobPriorState`/`invariantRegistry` through real adoption history is that milestone's own job to
  get right and prove with its own tests — not something this milestone's generic ruling logic can
  enforce on M6's behalf.
