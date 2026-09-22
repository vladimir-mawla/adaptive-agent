import type { InvariantId } from "./ids.js";

/**
 * `Invariant` — a frozen, closed-list constraint the agent was *given*,
 * never one it can propose changing (plan §2): `{ id: InvariantId, knob:
 * KnobId, description }`, exactly the three fields the plan names.
 *
 * WHY `KnobId` IS A GENERIC TYPE PARAMETER HERE, NOT A FIXED TYPE — THE
 * CENTRAL DESIGN CALL THIS FILE MAKES FOR THE WHOLE MILESTONE, RECORDED
 * ONCE HERE SINCE `Invariant` IS THE FIRST TYPE PLAN §2 NAMES IT ON: the
 * plan's own text describes `KnobId` as "a closed, per-domain enum...
 * e.g., in the M6 domain: `escalation-aggressiveness`,
 * `response-directness`, `auto-refund-ceiling`" — i.e., the actual literal
 * union of knob names is not this milestone's to invent. `domains/
 * support-triage/**` (M6, unbuilt per this milestone's own scope: "No
 * engine logic... M1 defines the types") is the first and only place a
 * concrete `KnobId` union is meant to exist. Hard-coding that domain's
 * three literal names into `lib/contracts` now would guess a downstream
 * milestone's own vocabulary before it exists — the identical mistake
 * `agent-control-tower`'s own `conflict.ts` documents refusing to make for
 * a richer `Conflict` record shape ("guessing now... would freeze a wrong
 * shape into `lib/contracts` for every later milestone to inherit").
 *
 * So `Invariant<KnobId extends string = string>` makes the SHAPE a domain
 * contract must have — "the knob a constraint targets is one literal
 * string value out of some closed set" — real and checkable, while
 * leaving WHICH literals populate that set to whichever milestone actually
 * has a domain (M6). This is `.genesis/PLAN.md`'s own M1 scope line,
 * "`KnobId`-shaped domain contract," taken at its word: M1 ships the
 * shape, not the contents.
 *
 * THE HONEST LIMIT THIS CHOICE CARRIES, STATED AT ITS FULL STRENGTH, NOT
 * STRONGER: `Invariant` (this file) and `BehaviorDelta` (behavior-delta.ts)
 * BY THEMSELVES, unparameterized (`Invariant<string>`, the default),
 * accept ANY string as a knob name — free text, exactly what the plan says
 * must be refused. The refusal is a property of a DOMAIN's own narrowed
 * instantiation (e.g. `Invariant<"escalation-aggressiveness" |
 * "response-directness" | "auto-refund-ceiling">`), once M6 supplies one —
 * never of `Invariant`/`BehaviorDelta` alone. `__tests__/invariant.test.ts`
 * and `__tests__/behavior-delta.test.ts` both prove this exact shape: a
 * LOCAL, test-only literal union stands in for a not-yet-built domain's
 * `KnobId`, and assigning a knob name outside that local union fails to
 * compile — the same "prove the mechanism on a local stand-in, don't
 * dishonestly widen or pre-guess the real thing" discipline
 * `agent-control-tower`'s `assertNeverIntervention` test documents for its
 * own exhaustiveness proof.
 *
 * THE REGISTRY-IMMUTABILITY REFUSAL NAMED IN THE PLAN — "the list of
 * `InvariantId` values is declared once per domain at setup and is not
 * extensible at runtime from anywhere in `lib/` or `domains/`... no
 * function anywhere in this codebase adds to or mutates an invariant
 * registry after it is constructed" (plan §2) — IS NOT THIS FILE'S JOB
 * TO PROVE. It is a claim about the absence of mutating code across the
 * whole `lib/`/`domains/` tree, which does not exist yet outside this
 * milestone; `.genesis/PLAN.md`'s own M4 section names the actual
 * mechanism ("a source-scan test, in the same spirit as
 * `agent-control-tower`'s literal-substring scan... invariants are read,
 * never written, from inside the running system"). This file only fixes
 * `Invariant`'s shape; M4's `lib/invariants/**` (unbuilt) is where that
 * scan belongs, once there is a registry and gate function to scan.
 */
export interface Invariant<KnobId extends string = string> {
  readonly id: InvariantId;
  readonly knob: KnobId;
  readonly description: string;
}
