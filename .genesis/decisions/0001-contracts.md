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

## Decision 1 — `AdaptationDecision.frozen`: no `tally` field, proven with `@ts-expect-error`, not by convention

`AdaptationDecision` is implemented exactly as plan §2's code block: four variants discriminated on
`kind`, `frozen` carrying only `{ kind, deltaId, invariant }` — no `tally` property is declared on
that member anywhere in `adaptation-decision.ts`. Because the union is discriminated (every member
has a distinct literal `kind`), TypeScript's excess-property check narrows an object literal with
`kind: "frozen"` to that member specifically and rejects any key the member doesn't declare — so
writing `{ kind: "frozen", deltaId, invariant, tally: someTally }` directly is a compile error at the
`tally` key, not a runtime check a caller could skip.

**Falsifiability, run for real, not just described:** `lib/contracts/adaptation-decision.ts`'s
`frozen` member was temporarily edited to `{ ...; readonly tally?: EvidenceTally }` (an optional
field, minimal and uncompensated — no other file touched). `npm run typecheck` was run and failed,
but not the way a missing check would fail: it failed with `TS2578: Unused '@ts-expect-error'
directive` at `lib/contracts/__tests__/adaptation-decision.test.ts`'s own frozen/tally test — proof
that the `@ts-expect-error` there was doing real work, not decorating an already-broken build. The
edit was reverted and `typecheck` returned to clean (0 errors), confirmed again after restoring.

A second, independent falsifiability run: `assertNeverAdaptationDecision`'s exhaustiveness mechanism
was proven live, not assumed, on a **local five-kind stand-in union** in the same test file (never on
the real four-variant type, to avoid dishonestly widening it just to make a point — matching
`agent-control-tower`'s own `assertNeverIntervention` test's documented choice). The stand-in switch's
`"bogus"` case was temporarily removed; `npm run typecheck` failed with exactly the predicted error —
`TS2345: Argument of type '{ kind: "bogus"; }' is not assignable to parameter of type 'never'` — at
the `assertNeverStandIn(decision)` call site, because `decision` was narrowed to the unhandled shape
in the `default` branch. Restoring the case returned `typecheck` to clean.

A third run, against the "no override parameter" claim specifically: `assertNeverAdaptationDecision`'s
signature was temporarily edited to add a second, optional `humanOverride?: string` parameter — a
direct stand-in for the exact failure mode plan §4 (M5) names ("to ever consult a 'human override'
parameter"). `npm test -- lib/contracts/__tests__/architecture.test.ts` failed immediately, flagging
the injected parameter by file and line. Reverting the edit returned the suite to green. This is the
one falsifiability experiment this report calls out as the most important: it is the only one of the
three that directly exercises the plan's own words ("no such parameter exists in this function's
signature at all") rather than the `tally`/exhaustiveness mechanics, and it is a check on THIS
milestone's own code, honestly scoped — see Decision 3 for what it does and does not prove about M5.

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

- `KnobId`/`KnobValue` free-text refusal is real only once a domain narrows the generic type
  parameters (Decision 3) — the unparameterized default does not refuse anything, and this is tested
  and disclosed, not silently left as a gap for a reader to find later.
- The invariant-registry-immutability refusal named in plan §2 ("no function anywhere in this
  codebase adds to or mutates an invariant registry after it is constructed") is M4's job
  (`lib/invariants/**`, unbuilt) to scan for, once a registry and a gate function exist to scan — this
  milestone only fixes `Invariant`'s shape.
- The "no override parameter" scan is a naming-level check on M1's own code today, not a guarantee
  about M5's future signature (Decision 5).
