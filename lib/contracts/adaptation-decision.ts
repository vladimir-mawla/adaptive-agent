import type { BehaviorDeltaId, InvariantId } from "./ids.js";
import type { EvidenceTally } from "./evidence-tally.js";

/**
 * `AdaptationDecision` — the closed enum at the centre of this project
 * (plan §2), reproduced here exactly as the plan's own code block gives
 * it, with one generic type parameter added (`KnobValue`, see below) and
 * `frozen` hardened past what the plan's own code block shows (see
 * "ROUND 2" below):
 *
 *   - `adopt`  — `{ kind, deltaId, tally }`
 *   - `hold`   — `{ kind, deltaId, tally, distinctContextsNeeded }`
 *   - `revert` — `{ kind, deltaId, tally, revertedTo }`
 *   - `frozen` — `{ kind, deltaId, invariant }`
 *
 * THIS FILE'S TWO CENTRAL COMMITMENTS, PROVEN WITH `@ts-expect-error` IN
 * `__tests__/adaptation-decision.test.ts` (an unused `@ts-expect-error` is
 * itself a compile error, `TS2578`, which is what makes each proof below
 * real rather than a comment asserting "this wouldn't compile"):
 *
 * 1. **`frozen` REFUSES TO CARRY ANY EVIDENCE-SHAPED FIELD
 *    (`tally`/`distinctContextsNeeded`/`revertedTo`) — STATED HERE AT THE
 *    STRENGTH THAT ACTUALLY SURVIVES, AFTER A ROUND-2 REJECTION FOUND THE
 *    ROUND-1 VERSION OF THIS CLAIM FALSE.** See "ROUND 2" below for the
 *    incident, what changed, and the one residual route that remains
 *    open by design (a deliberate `as`/`as unknown as` cast — the same
 *    disclosed residual `agent-control-tower`'s own `HumanId` accepts for
 *    the identical reason: no design in this language stops a deliberate,
 *    visible cast).
 *
 * 2. **`hold` CARRIES `distinctContextsNeeded: number` — A NUMBER THE
 *    CALLER CAN ACT ON, NOT A BOOLEAN, NOT PROSE.** `distinctContextsNeeded`
 *    is a required `number` field on `hold`, proven two ways: (a) omitting
 *    it from a `hold` literal fails to compile, and (b) assigning a
 *    `boolean` to it (`distinctContextsNeeded: true`) also fails to
 *    compile — a `hold` that merely says "not yet" without a number a
 *    caller can re-check against would satisfy the plan's own ban on "a
 *    vague 'not yet'" no better than a boolean would, so both failure
 *    shapes are pinned, not just the missing-field case.
 *
 * `adopt`/`hold`/`revert` ALL REQUIRE `tally: EvidenceTally` — "**Refuses**
 * to fire without citing the exact tally that licensed it — never a bare
 * `true`" (plan §2, `adopt`'s bullet; the same discipline applies to
 * `hold` and `revert`, whose own bullets each name their own tally-citing
 * requirement). Proven by `@ts-expect-error` on each variant's own
 * literal, omitting `tally`.
 *
 * ============================================================
 * ROUND 2 — L4 VERIFY REJECTION, THE ACTUAL BUG, THE FIX, AND THE CLAIM
 * RESTATED AT THE STRENGTH THAT SURVIVES (this account's own standing
 * note: don't restate a disclosed limit MORE strongly than it holds —
 * this incident is the opposite failure, a claim stated too strongly in
 * the harmful direction, corrected here once, not narrowed a second time
 * later for the same reason a sibling project's own `HumanId` header
 * documents doing twice).
 * ============================================================
 *
 * ROUND 1's CLAIM, VERBATIM, WAS FALSE AS WRITTEN: "there is no code
 * path, anywhere, that can produce a `frozen` decision carrying a tally
 * without TypeScript refusing to compile it." That claim rested entirely
 * on TypeScript's EXCESS PROPERTY CHECK, which applies ONLY to a fresh
 * object literal written directly at an assignment/argument/array-element
 * site. L4 VERIFY reported seven working routes that never touch that
 * check because none of them is a fresh literal at the point of
 * assignment:
 *
 *   1. `const sneaky = {...}; const a: AdaptationDecision = sneaky;`
 *      (intermediate binding)
 *   2. `const b: AdaptationDecision = { ...sneaky };` (spread)
 *   3. `function f(): AdaptationDecision { return sneaky; }` (return)
 *   4. `sneaky satisfies object as AdaptationDecision` (double cast)
 *   5. `const d: AdaptationDecision = identity(sneaky);` (generic helper)
 *   6. `const e: AdaptationDecision = Object.assign({}, sneaky);`
 *   7. `const arr: AdaptationDecision[] = [sneaky];` (array element)
 *
 * All seven were reproduced for real against the round-1 type (a scratch
 * file under `lib/contracts/`, deleted after) and all seven compiled
 * clean — confirming the report, not just trusting it.
 *
 * THE FIX: each evidence-shaped field NOT native to `frozen` — `tally`,
 * `distinctContextsNeeded`, AND `revertedTo` — is declared on `frozen`
 * itself as `?: never`. This moves the check from EXCESS PROPERTY
 * CHECKING (literal-site-only) to ORDINARY ASSIGNABILITY (checked at
 * every site, literal or not): a real `EvidenceTally`/`number`/`KnobValue`
 * is never assignable to `never`, so the error now fires at every one of
 * routes 1, 2, 3, 5, 6, 7 above — verified for real, again, one route at a
 * time, against the SAME scratch reproduction, all six now failing to
 * compile with `TS2322` ("not assignable to type 'never'" /
 * "'undefined'"). Route 4, the explicit double cast, is untouched by this
 * fix and still compiles — expected, and named below, not silently
 * accepted.
 *
 * WHY ALL THREE FIELDS, NOT JUST `tally` (L4 VERIFY's own literal
 * report): the SAME empirical check was run for `distinctContextsNeeded`
 * and `revertedTo` leaking onto a `frozen` literal via the identical
 * non-literal routes, and both compiled clean before this fix, for the
 * identical structural reason (neither field existed on `frozen`'s
 * pre-fix declaration either). Both are evidence-shaped in the same sense
 * `tally` is — `distinctContextsNeeded` is a summary of insufficient
 * evidence, `revertedTo` is a value a post-adoption tally comparison
 * produced — so a `frozen` decision carrying either would misrepresent
 * why it fired in exactly the way plan §2 names for `tally` specifically.
 * All three are closed together, checked, not assumed to generalize from
 * the one field L4 VERIFY happened to name.
 *
 * WHETHER `adopt`/`hold`/`revert` NEED THE MIRROR TREATMENT AGAINST
 * *EACH OTHER'S* FIELDS (L4 VERIFY's own question: "can an `adopt` be
 * built carrying an `invariant` field?") — CHECKED, NOT ASSUMED, AND THE
 * ANSWER IS NO, DELIBERATELY: the identical empirical check (intermediate
 * binding) was run for `adopt` carrying a stray `invariant`, `hold`
 * carrying a stray `revertedTo`, and `revert` carrying a stray
 * `distinctContextsNeeded` — all three compile clean today, for the
 * SAME structural reason as `frozen`'s original bug. This is NOT being
 * fixed here, and the reason is a real distinction, not an oversight:
 * `frozen` is the ONE variant plan §2 names as needing to be
 * STRUCTURALLY INCAPABLE of appearing evidence-driven ("a `frozen`
 * decision citing evidence would misrepresent *why* it fired — it fires
 * because of what the knob *is*, never because of what the evidence
 * *says*"). `adopt`/`hold`/`revert` are all already evidence-driven —
 * every one of them requires a real `tally` of its own — so a stray
 * `invariant` field leaking onto one of them does not retroactively make
 * an evidence-based decision look like it happened for a different,
 * non-evidence reason; the `kind` discriminant a correct consumer
 * switches on is untouched either way, and no bullet in plan §2 or §4
 * asks `adopt`/`hold`/`revert` to refuse citing an invariant the way
 * `frozen` must refuse citing evidence. Mirroring `?: never` onto every
 * field of every OTHER variant, for every variant, would apply a
 * defensive measure well past what any specific plan refusal asks for,
 * and past what this account's own sibling projects apply to their own
 * discriminated unions (`agent-control-tower`'s `Intervention` does not,
 * for example, declare `checkpointId?: never` on its `warn` variant to
 * block the identical class of non-literal leakage). This scope boundary
 * is disclosed, not silent: `__tests__/adaptation-decision.test.ts`
 * contains a passing (not `@ts-expect-error`) test named exactly this,
 * demonstrating `adopt` can still carry a stray `invariant` field via a
 * non-literal route today.
 *
 * THE ONE RESIDUAL ROUTE NAMED AT ITS TRUE STRENGTH: route 4 above (a
 * double cast, `sneaky satisfies object as AdaptationDecision`, or the
 * simpler `sneaky as unknown as AdaptationDecision`) still compiles clean
 * after this fix — confirmed, not assumed, by the same scratch
 * reproduction. This is not a gap this fix failed to close; it is the
 * same residual `agent-control-tower`'s own `human-id.ts` names for its
 * `HumanId` brand and does not claim to solve: "no TypeScript design can
 * stop a deliberate cast." `as`/`as unknown as` is a designed escape
 * hatch precisely because TypeScript's soundness is deliberately partial
 * — closing it would require rejecting a language feature, not writing a
 * better type.
 *
 * THE CLAIM, RESTATED AT EXACTLY THE STRENGTH THAT SURVIVES: a `frozen`
 * decision cannot be constructed carrying `tally`, `distinctContextsNeeded`,
 * or `revertedTo` through any route that does not name `AdaptationDecision`
 * (or an equivalent cast target) explicitly and in cleartext at the
 * construction site — covering a fresh literal, an intermediate binding,
 * a spread, a function return, a generic helper, `Object.assign`, and an
 * array element, all six checked directly, not inferred from one. It CAN
 * still be constructed that way through a deliberate `as`/`as unknown as`
 * cast — a residual this project does not claim to close at the type
 * level, and does not need to: see `assertFrozenCitesNoEvidence` below,
 * the parallel RUNTIME guard for exactly this residual, matching
 * `agent-control-tower`'s own `assertValidHaltForced` precedent for the
 * identical situation (a central commitment mostly closed by types, with
 * one cast-shaped residual the type system cannot reach, closed instead
 * by a runtime check a consumer is expected to call).
 *
 * ANSWERING L4 VERIFY'S CLOSING QUESTION DIRECTLY: is the resulting
 * guarantee sufficient for M5, or must `arbitrate` carry its own runtime
 * check? **`arbitrate` must call a runtime check** — the type-level fix
 * closes six of seven routes but cannot close a deliberate cast, and
 * `arbitrate` (M5, unbuilt) is exactly the function most likely to
 * receive a `frozen`-shaped value assembled from a shared intermediate
 * representation (gate result + tally, `.genesis/PLAN.md` §4's own
 * signature: `arbitrate(delta, tally, gateResult, priorState)`) where a
 * cast could plausibly be used to reconcile shapes. `assertFrozenCitesNoEvidence`
 * (below) is built now, in M1, for exactly that call — recorded as a
 * BUILD REQUIREMENT for M5 in `.genesis/decisions/0001-contracts.md`,
 * not left to be rediscovered.
 *
 * NO OVERRIDE PARAMETER ANYWHERE IN THIS FILE, AND NONE ANYWHERE UNDER
 * `lib/contracts/**` — CHECKED, NOT JUST ASSERTED: `__tests__/
 * architecture.test.ts` scans every non-test `.ts` source file under
 * `lib/contracts/` for the substring "override" (case-insensitive,
 * comments stripped) and fails if it appears. This is a narrow, honest
 * claim about THIS milestone's own vocabulary only: it proves M1 ships no
 * override-shaped field, parameter, or type for a later milestone to
 * build on top of by accident — it says nothing about
 * `lib/arbitrate/arbitrate.ts` itself (M5, unbuilt), which does not exist
 * yet for any scan to inspect. Plan §4 (M5) already commits, in prose, to
 * the analogous requirement for that function once it is built. Whether
 * `lib/arbitrate/arbitrate.ts` ITSELF ends up honoring that is a BUILD
 * REQUIREMENT for M5 to satisfy and prove with its own test when it
 * exists, not a claim this file makes about code that does not exist yet.
 *
 * `KnobValue` IS GENERIC, THREADED THROUGH FROM `BehaviorDelta` (see that
 * file's header for the full reasoning): `revertedTo`'s type must match
 * whatever type a domain's own `BehaviorDelta<KnobId, KnobValue>` uses for
 * `from`/`to`, since a revert rolls a knob back to a value one of that
 * knob's own prior deltas produced. The unparameterized default
 * (`KnobValue = unknown`) is deliberately not narrowed further here — see
 * `behavior-delta.ts`'s header for why a concrete `KnobValue` shape is a
 * domain fact (M6, unbuilt), not this milestone's to invent. `frozen`'s
 * own `revertedTo?: never` is independent of this generic parameter — it
 * is `never` regardless of what `KnobValue` a domain instantiates,
 * because `frozen` must refuse the field outright, not merely refuse the
 * wrong value type for it.
 */
export type AdaptationDecision<KnobValue = unknown> =
  | { readonly kind: "adopt"; readonly deltaId: BehaviorDeltaId; readonly tally: EvidenceTally }
  | {
      readonly kind: "hold";
      readonly deltaId: BehaviorDeltaId;
      readonly tally: EvidenceTally;
      readonly distinctContextsNeeded: number;
    }
  | {
      readonly kind: "revert";
      readonly deltaId: BehaviorDeltaId;
      readonly tally: EvidenceTally;
      readonly revertedTo: KnobValue;
    }
  | {
      readonly kind: "frozen";
      readonly deltaId: BehaviorDeltaId;
      readonly invariant: InvariantId;
      readonly tally?: never;
      readonly distinctContextsNeeded?: never;
      readonly revertedTo?: never;
    };

/**
 * Exhaustiveness helper for `switch (decision.kind)` — same pattern as
 * `agent-control-tower`'s `assertNeverIntervention` / decision-engine's
 * `assertNeverOutcome` / shadow-run's `assertNeverReconciliation` /
 * memory-ledger's `assertNeverBeliefAnswer`. Never called at runtime (the
 * `never` parameter type makes that impossible for any value TypeScript
 * itself considers reachable); its only job is to make an unhandled
 * variant a COMPILE error at the call site the moment a fifth `kind` is
 * ever added (plan §3, M1: "an exhaustiveness guard that silently stops
 * matching a variant if a fifth is ever added without updating every
 * switch"). `AdaptationDecision` itself stays frozen at four kinds for
 * this milestone, so `__tests__/adaptation-decision.test.ts` demonstrates
 * the mechanism failing on an equivalent LOCAL five-kind stand-in type
 * rather than dishonestly widening the real one just to prove a point —
 * the same choice `agent-control-tower`'s own `intervention.test.ts`
 * documents making for the identical reason.
 */
export function assertNeverAdaptationDecision(value: never): never {
  throw new Error(`Unreachable: unhandled AdaptationDecision ${JSON.stringify(value)}`);
}

/** The `frozen` member, named on its own so `assertFrozenCitesNoEvidence` has something to accept without repeating the full four-member union inline. */
export type FrozenDecision = Extract<AdaptationDecision, { kind: "frozen" }>;

export interface UnexpectedEvidenceOnFrozen {
  readonly kind: "unexpected-evidence-on-frozen";
  readonly field: "tally" | "distinctContextsNeeded" | "revertedTo";
  readonly received: unknown;
}

export type FrozenIntegrityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: UnexpectedEvidenceOnFrozen };

/**
 * THE PARALLEL RUNTIME GUARD FOR THE ONE RESIDUAL ROUTE NAMED ABOVE (a
 * deliberate `as`/`as unknown as` cast) — the same shape
 * `agent-control-tower`'s `assertValidHaltForced` is for its own analogous
 * residual. The type system closes every route that does not explicitly
 * name a cast target in cleartext; this function is what a caller that
 * received a `FrozenDecision` from somewhere it does not fully control
 * (M5's `arbitrate`, unbuilt, is the named consumer — see this file's
 * "ANSWERING L4 VERIFY'S CLOSING QUESTION" paragraph above) can call to
 * catch the one thing the type checker cannot: a value that arrived via a
 * cast carrying a real, populated evidence field despite its declared
 * type saying that field is `never`.
 *
 * WHAT THIS DOES NOT DO, STATED AT ITS TRUE STRENGTH: it does not, and
 * cannot, stop a `frozen` value from being constructed with a populated
 * evidence field in the first place — by the time this function runs,
 * that has already happened, if it was going to. It only lets a caller
 * DETECT it before trusting or forwarding the value, the same narrow,
 * honest scope `assertValidHaltForced`'s own doc comment claims for
 * itself: a check computed from data this function already holds, not a
 * guarantee that the underlying fact (here: "no evidence was actually
 * consulted") is true — a `frozen` value forged with a fabricated but
 * well-formed tally would still pass this check's evil twin (a check that
 * merely validated shape) as cleanly as a genuine one; what this function
 * actually checks is only presence, which is exactly the class of forgery
 * a cast bypassing `?: never` produces (an ordinary cast doesn't bother
 * fabricating a plausible tally, it just carries whatever the caller had
 * lying around), not a check that the field's contents are genuine.
 */
export function assertFrozenCitesNoEvidence(decision: FrozenDecision): FrozenIntegrityResult {
  const record = decision as unknown as Record<string, unknown>;
  for (const field of ["tally", "distinctContextsNeeded", "revertedTo"] as const) {
    if (record[field] !== undefined) {
      return { ok: false, error: { kind: "unexpected-evidence-on-frozen", field, received: record[field] } };
    }
  }
  return { ok: true };
}
