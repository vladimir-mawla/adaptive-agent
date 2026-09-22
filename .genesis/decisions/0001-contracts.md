# ADR 0001 — M1 contracts: the generic `KnobId`/`KnobValue` gap, the two central proofs, and what M1 does not claim

- **Date:** 2026-09-23
- **Status:** accepted
- **Phase / milestone:** M1 (BUILD) — `lib/contracts/`

## Context

`.genesis/PLAN.md` §2 names five load-bearing types M1 must fix: `Invariant`, `BehaviorDelta`,
`Episode`, `EvidenceTally`, and the closed enum at the centre, `AdaptationDecision`. The plan's own
report calls out two commitments as the ones that matter most: (1) `frozen` must have no `tally`
field even representable at the type level, and no override parameter may exist anywhere the
arbitration function (M5, unbuilt) could reach for; (2) `hold` must carry a number
(`distinctContextsNeeded`), not a boolean or prose. This ADR records the shape chosen for each type,
the alternatives rejected, and — per this account's own standing discipline against silently
resolving an ambiguous plan — a real gap the plan's own text leaves open, and how this milestone
chose to close it rather than guess past it.

## Decision 1 — `AdaptationDecision.frozen`: refuses evidence-shaped fields, proven with `@ts-expect-error` — REVISED AFTER L4 VERIFY REJECTION (round 2)

### Round 1 (original decision, since falsified and corrected)

`AdaptationDecision` was implemented exactly as plan §2's code block: four variants discriminated on
`kind`, `frozen` carrying only `{ kind, deltaId, invariant }` — no `tally` property declared on that
member. The round-1 claim was: "because the union is discriminated, TypeScript's excess-property check
narrows an object literal with `kind: "frozen"` to that member and rejects any key it doesn't
declare... there is no code path, anywhere, that can produce a `frozen` decision carrying a tally
without TypeScript refusing to compile it."

**This claim was rejected by L4 VERIFY and confirmed false, not merely imprecise.** Excess property
checking applies *only* to a fresh object literal written directly at an assignment, argument, or
array-element site. L4 VERIFY reported seven working routes that never trigger it because none of
them is a fresh literal at the point of assignment:

```ts
const sneaky = { kind: "frozen" as const, deltaId: D, invariant: I, tally: T };
const a: AdaptationDecision = sneaky;            // intermediate binding
const b: AdaptationDecision = { ...sneaky };     // spread
function f(): AdaptationDecision { return sneaky; }
const c = sneaky satisfies object as AdaptationDecision;
const d: AdaptationDecision = identity(sneaky);  // generic helper
const e: AdaptationDecision = Object.assign({}, sneaky);
const arr: AdaptationDecision[] = [sneaky];
```

All seven were reproduced for real, independently, against the round-1 type (a scratch file under
`lib/contracts/`, deleted after) — all seven compiled clean, confirming the report rather than
trusting it.

### Round 2 — the fix, verified route by route, and the claim restated at the strength that survives

**The fix:** `frozen` now declares `tally?: never`, `distinctContextsNeeded?: never`, and
`revertedTo?: never` explicitly (all three evidence-shaped fields, not just `tally` — see "why all
three" below). This moves the check from excess-property checking (literal-site-only) to ordinary
assignability (checked at every site, literal or not): a real `EvidenceTally`/`number`/`KnobValue` is
never assignable to `never`, so the error now fires at routes 1, 2, 3, 5, 6, 7 above.

**Verified route by route, not just once:** each of the six closable routes was re-run against the
fixed type and confirmed to fail with `TS2322` ("not assignable to type 'never'"/"'undefined'"); each
now has its own `@ts-expect-error` proof in `__tests__/adaptation-decision.test.ts` ("TYPE-LEVEL route
1/6" through "6/6"), built against a single `sneaky` value carrying all three evidence fields at once
so a narrower fix touching only one field could not pass silently. Route 4 (the explicit
`satisfies object as AdaptationDecision` cast, or the simpler `as unknown as AdaptationDecision`) was
re-run and still compiles clean — expected, not accidental, and pinned as a *passing* (not
`@ts-expect-error`) test named "DISCLOSED RESIDUAL" so the gap is documented rather than
silently rediscoverable.

**Why all three evidence fields, not just `tally` (L4 VERIFY's report named only `tally`):** the
identical empirical check was run for `distinctContextsNeeded` and `revertedTo` leaking onto a
`frozen` literal via the same non-literal routes — both compiled clean before this fix, for the
identical structural reason. Both are evidence-shaped in the sense that matters to the plan's own
reasoning: `distinctContextsNeeded` summarizes insufficient evidence, `revertedTo` is a value a
post-adoption tally comparison produced. A `frozen` decision carrying either would misrepresent why it
fired in exactly the way plan §2 names for `tally` specifically, so all three are closed together,
checked, not assumed to generalize from the one field named in the report.

**Whether `adopt`/`hold`/`revert` need the mirror treatment against each other's fields — checked, not
assumed, and the answer is no, deliberately:** L4 VERIFY asked directly: "can an `adopt` be built
carrying an `invariant` field?" The identical empirical check (intermediate binding) was run for
`adopt` carrying a stray `invariant`, `hold` carrying a stray `revertedTo`, and `revert` carrying a
stray `distinctContextsNeeded` — all three compile clean today, for the same structural reason as
`frozen`'s original bug. **This is deliberately not fixed.** `frozen` is the one variant plan §2 names
as needing to be structurally incapable of appearing evidence-driven ("a `frozen` decision citing
evidence would misrepresent *why* it fired"). `adopt`/`hold`/`revert` are all already evidence-driven
— each requires a real `tally` of its own — so a stray field from a different variant does not
retroactively make an evidence-based decision look like it fired for a different, non-evidence reason;
the `kind` discriminant a correct consumer switches on is untouched either way, and no plan bullet asks
these three to refuse citing an invariant the way `frozen` must refuse citing evidence. Mirroring
`?: never` onto every field of every other variant would be a defensive measure past what any specific
plan refusal asks for, and past what this account's own sibling projects apply to their own
discriminated unions (`agent-control-tower`'s `Intervention` does not declare `checkpointId?: never`
on its `warn` variant to block the identical class of leakage). This scope boundary is disclosed as a
passing "HONEST LIMIT" test in `__tests__/adaptation-decision.test.ts`, not left silent.

**The claim, restated once, at exactly the strength that survives:** a `frozen` decision cannot be
constructed carrying `tally`, `distinctContextsNeeded`, or `revertedTo` through any route that does not
name `AdaptationDecision` (or an equivalent cast target) explicitly and in cleartext at the
construction site — a fresh literal, an intermediate binding, a spread, a function return, a generic
helper, `Object.assign`, and an array element, all six checked directly. It *can* still be constructed
that way through a deliberate `as`/`as unknown as` cast. This is the same disclosed residual
`agent-control-tower`'s own `HumanId` names and does not claim to solve: no TypeScript design stops a
deliberate, visible cast — closing it would mean rejecting a language feature, not writing a better
type.

**Is the resulting guarantee sufficient for M5, or must `arbitrate` carry its own runtime check?**
**`arbitrate` must call a runtime check.** The type-level fix closes six of seven routes but cannot
close a deliberate cast, and `arbitrate` (M5, unbuilt; plan §4's own signature is
`arbitrate(delta, tally, gateResult, priorState)`) is exactly the function most likely to assemble a
`frozen`-shaped return value from a shared intermediate representation where a cast could plausibly be
used to reconcile shapes. `assertFrozenCitesNoEvidence` (new in this round, `adaptation-decision.ts`)
is the parallel runtime guard, built now in M1 rather than deferred — the same shape
`agent-control-tower`'s `assertValidHaltForced` takes for its own analogous residual: it inspects a
`FrozenDecision` value for a populated `tally`/`distinctContextsNeeded`/`revertedTo` at runtime and
returns a typed `{ ok: false, error }` if any is present, rather than throwing directly (so a caller
must inspect the result, not just avoid catching an exception). **This is recorded here as a BUILD
REQUIREMENT for M5: `arbitrate` must call `assertFrozenCitesNoEvidence` on any `frozen` decision it is
about to return or forward, and refuse to trust one that fails it** — not left to be rediscovered when
M5 is built. What this function does NOT do, stated at its true strength: it cannot stop a `frozen`
value from being constructed with a populated evidence field in the first place, and it cannot verify
that a *forged but well-formed* evidence field (e.g. a fabricated `EvidenceTally` shape) is genuine —
it only checks presence, the same honest, narrow scope `assertValidHaltForced` claims for itself
against forged-but-well-formed `HumanId`/`ConflictId` values.

**Falsifiability, run for real at every step above, not just described once:**
1. `frozen`'s `tally` field was temporarily made optional (`tally?: EvidenceTally`, minimal,
   uncompensated) → `typecheck` failed with `TS2578` (unused `@ts-expect-error`) at the frozen/tally
   test, not the error it expects → reverted, clean again.
2. `assertNeverAdaptationDecision`'s exhaustiveness mechanism was proven live on a **local five-kind
   stand-in union** (never the real four-variant type): the `"bogus"` case was removed from the
   stand-in switch → `typecheck` failed with the predicted `TS2345` at the exact call site → restored.
3. `assertNeverAdaptationDecision`'s signature was temporarily edited to add a `humanOverride?: string`
   parameter, a direct stand-in for the exact failure mode plan §4 (M5) names → the override-scan test
   (`__tests__/architecture.test.ts`) failed immediately, flagging the injected parameter by file and
   line → reverted, suite green again.
4. **Round 2's own fix** (`tally?: never`/`distinctContextsNeeded?: never`/`revertedTo?: never`) was
   itself removed in full and `typecheck` was re-run: all six of the new route-level
   `@ts-expect-error` proofs failed together with `TS2578` (unused directive), confirming every one of
   them is load-bearing on the fix, not decorative → the fix was restored and `typecheck`/`npm test`
   both returned to clean (45/45 passing).

## Decision 2 — `hold.distinctContextsNeeded`: a required `number`, proven both missing and mistyped

`hold` carries `distinctContextsNeeded: number` as a required field. Two `@ts-expect-error` proofs,
not one: omitting the field from a `hold` literal fails to compile, and separately, assigning a
`boolean` (`distinctContextsNeeded: true`) to it also fails to compile. The second proof exists
because a sibling project's own retrospective names the exact failure mode this guards against: a
guard whose assertions are both *implications* can pass vacuously on a table that never actually
exercises the false branch. Proving only the missing-field case would leave open whether a caller
satisfying the field with a boolean (technically "present") would also be refused — it is refused,
and now that is checked, not assumed.

## Decision 3 — `KnobId` and `KnobValue`: generic type parameters, not a fixed literal union or a fixed value type — the plan gap this milestone found

**The gap, stated plainly:** `.genesis/PLAN.md` §2 describes `KnobId` as "a closed, per-domain enum
... e.g., in the M6 domain: `escalation-aggressiveness`, `response-directness`,
`auto-refund-ceiling`" — i.e., the plan's own prose says the concrete literal values belong to a
domain (M6, `domains/support-triage/**`, unbuilt), not to M1. Separately, and not flagged anywhere in
the plan's own §2 "Supporting types" bullets, `KnobValue` is used directly in §2's own
`AdaptationDecision` code block (`revertedTo: KnobValue`) but is never defined as a type anywhere in
that section — no bullet states what type a knob's value actually is, and no bullet for
`BehaviorDelta` states what type `from`/`to` are either (only that both must be present). This
milestone's M1 scope line itself hints at the intended resolution — "`Invariant`, `KnobId`-shaped
domain contract, `BehaviorDelta`, ..." — reading "`KnobId`-shaped domain contract" as this milestone's
job being the SHAPE a domain contract must have, not its concrete contents.

**Alternative considered and rejected: hard-code the M6 domain's three literal knob names
(`"escalation-aggressiveness" | "response-directness" | "auto-refund-ceiling"`) directly into
`Invariant`/`BehaviorDelta` now.** Rejected for the same reason `agent-control-tower`'s own
`conflict.ts` gives for deferring a richer `Conflict` record shape to M3: M1's own scope line is
explicit that "No engine logic — M3 tallies evidence, M4 gates invariants, M5 arbitrates," and by the
same principle, M6 (`domains/support-triage/**`) is the milestone that owns this domain's actual
vocabulary. Freezing M6's own knob names into `lib/contracts` at M1 would guess a downstream
milestone's design before it exists, and — worse — would make `lib/contracts` itself no longer
domain-agnostic, contradicting the plan's own architecture line that `lib/contracts` sits below
`lib/evidence`/`lib/invariants`/`lib/arbitrate`/`domains/support-triage` in one direction, never the
reverse.

**Alternative considered and rejected: an opaque branded `KnobId` (the `ids.ts`-style pattern used for
`InvariantId`/`BehaviorDeltaId`/`ContextId`).** Rejected on the merits, not by omission: an opaque
brand only stops a `KnobId`-typed value from being confused with a different brand at a call site — it
does not, and cannot, express "one of a specific closed set of literal names," because any string
handed to its minting function would be accepted. That is exactly the free-text hole plan §2 refuses
("it is a literal union member, checked against the domain's own frozen list") — a brand cannot deliver
that, only a literal string union can.

**Chosen shape:** `Invariant<KnobId extends string = string>` and
`BehaviorDelta<KnobId extends string = string, KnobValue = unknown>`, with `AdaptationDecision<KnobValue
= unknown>` threading the same `KnobValue` through for `revertedTo` (a revert rolls a knob back to a
value the same knob's own prior deltas produced, so the two must share a type). A domain (M6) narrows
both type parameters together once it exists — e.g. `Invariant<SupportTriageKnobId>` and
`BehaviorDelta<SupportTriageKnobId, number>`.

**The honest limit this carries, stated once, at its true strength:** `Invariant`/`BehaviorDelta`,
*unparameterized* (the default `KnobId = string`), do **not** refuse free-text knob names — nothing in
`lib/contracts` alone closes that set, because no domain contract exists yet to close it against.
`__tests__/behavior-delta.test.ts` and `__tests__/invariant.test.ts` both contain a test named exactly
this ("HONEST LIMIT: the unparameterized default ... does NOT refuse free text") proving the gap is
real and disclosed, not silently left for a reader to discover. What this milestone *does* prove,
against a **local stand-in union** standing in for a not-yet-built M6 domain (the same "prove the
mechanism on a local stand-in, don't pre-guess or widen the real thing" discipline
`agent-control-tower`'s `assertNeverIntervention` test already established): once a domain narrows the
type parameter, a knob name outside that domain's own closed set fails to compile. Whether M6's actual
domain file instantiates the type parameter correctly (rather than, say, leaving it at the
unparameterized default by omission) is that milestone's own job to get right and to prove with its
own test — not something M1's generic scaffolding can enforce on M6's behalf.

## Decision 4 — supporting `ids.ts`/`timestamp.ts` files not named in the plan's own M1 file list

`.genesis/PLAN.md` §3 (M1)'s "Files it owns" names exactly `invariant.ts`, `behavior-delta.ts`,
`episode.ts`, `evidence-tally.ts`, `adaptation-decision.ts`, `index.ts`, and `__tests__/*.test.ts` — no
`ids.ts` or `timestamp.ts`. But `Invariant.id: InvariantId`, `BehaviorDelta.id`/`proposedAt`,
`Episode.deltaId`/`contextId`/`observedAt`, `EvidenceTally.deltaId`, and every `AdaptationDecision`
variant's `deltaId` (all named directly in the plan's own §2 prose and code block) cannot be typed at
all without somewhere to declare `InvariantId`, `BehaviorDeltaId`, `ContextId`, and `Timestamp`. This
is flagged here as a plan omission, not silently patched around: `lib/contracts/ids.ts` and
`lib/contracts/timestamp.ts` were added as the minimal, structurally necessary home for these opaque
identity brands, matching `agent-control-tower`'s own `ids.ts`/`timestamp.ts` shape (one file for the
identity brands that don't need a `HumanId`-style no-minting restriction, since nothing in this
project's plan makes "an engine minted its own `InvariantId`/`BehaviorDeltaId`/`ContextId`" a failure
mode the way minting a `HumanId` was for that project's `halt`/`forced`).

## Decision 5 — the "no override parameter" refusal: what M1 can prove today, and what is a build requirement for M5

Plan §4 (M5, unbuilt) commits `arbitrate` to never consulting "a 'human override' parameter for a
`frozen` gate result, because no such parameter exists in this function's signature at all." M5 does
not exist yet, so no test in this milestone can inspect its actual signature. What M1 can and does
prove, honestly scoped: `__tests__/architecture.test.ts` scans every non-test `.ts` file's CODE (block
and line comments stripped first, since this milestone's own documentation legitimately uses the
English word "override" dozens of times to explain this exact refusal) under `lib/contracts/` for the
substring "override," case-insensitive, and fails if it appears — proven to actually catch a real
offense by temporarily adding a `humanOverride?: string` parameter to `assertNeverAdaptationDecision`
and confirming the test failed, then reverting (see Decision 1's third falsifiability run). This
proves the narrower claim that M1's own vocabulary gives M5 nothing named "override" to build on top
of by accident. It is **not**, and is not claimed anywhere in this codebase to be, a guarantee about
`lib/arbitrate/arbitrate.ts`'s eventual signature — that is a build requirement recorded here for M5
itself to satisfy and prove with its own test when it exists, not a claim this milestone makes about
code that does not exist yet.

## What this milestone does not claim

- **`frozen`'s refusal of evidence-shaped fields (Decision 1) does not close a deliberate `as`/`as
  unknown as` cast** — six of seven reported routes are closed at the type level; the seventh is a
  disclosed residual with its own passing test and its own runtime guard
  (`assertFrozenCitesNoEvidence`), not a claim that no code path can ever produce a contaminated
  `frozen` value.
- **`adopt`/`hold`/`revert` are not defended against carrying a stray field belonging to a different
  variant** (e.g. `adopt` carrying `invariant`) — checked and confirmed possible via the same
  non-literal routes, and deliberately left open because no plan refusal names that pairing as a
  misrepresentation risk the way `frozen`+evidence is named (Decision 1).
- `KnobId`/`KnobValue` free-text refusal is real only once a domain narrows the generic type
  parameters (Decision 3) — the unparameterized default does not refuse anything, and this is tested
  and disclosed, not silently left as a gap for a reader to find later.
- The invariant-registry-immutability refusal named in plan §2 ("no function anywhere in this
  codebase adds to or mutates an invariant registry after it is constructed") is M4's job
  (`lib/invariants/**`, unbuilt) to scan for, once a registry and a gate function exist to scan — this
  milestone only fixes `Invariant`'s shape.
- The "no override parameter" scan is a naming-level check on M1's own code today, not a guarantee
  about M5's future signature (Decision 5).
