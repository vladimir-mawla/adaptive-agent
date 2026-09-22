/**
 * Opaque branded identity tokens shared across this milestone's contracts:
 * `InvariantId`, `BehaviorDeltaId`, `ContextId`.
 *
 * NOT NAMED IN THE PLAN'S OWN M1 "Files it owns" LIST (`.genesis/PLAN.md`
 * §3, M1), which names only `invariant.ts`, `behavior-delta.ts`,
 * `episode.ts`, `evidence-tally.ts`, `adaptation-decision.ts`, `index.ts`,
 * and `__tests__/*.test.ts` — flagged in this milestone's PR/report and in
 * `.genesis/decisions/0001-contracts.md` as a plan omission, not silently
 * patched over: `BehaviorDelta.id`, `Episode.deltaId`/`contextId`,
 * `EvidenceTally.deltaId`, and every `AdaptationDecision` variant's
 * `deltaId` (plan §2's own code block) cannot be typed at all without
 * somewhere to declare these three brands, and `Invariant.id: InvariantId`
 * is named directly in the plan's own bullet. This file is the minimal,
 * structurally necessary home for them — one file, matching
 * `agent-control-tower`'s own `ids.ts`, not five near-identical files, for
 * the same reason that project's own header gives: no import cycle forces
 * a split here either.
 *
 * WHY BRANDED, NOT BARE `string`: a bare `string` field would let a
 * `ContextId` be handed wherever a `BehaviorDeltaId` or `InvariantId` is
 * expected, silently, at every call site from M3 (`lib/evidence`) onward.
 * Each brand stops that at the type level.
 *
 * NO PARSERS: none of these three carries an invariant beyond "is a
 * string" — they are opaque identity tokens (a UUID, a ULID, a ticket
 * number), not values with a range or a grammar to validate. Each gets a
 * minting function that owns only the brand. Unlike `agent-control-tower`'s
 * `HumanId`, none of these three needs to be UN-mintable: nothing in this
 * project's plan makes "an engine minted its own `InvariantId`/
 * `BehaviorDeltaId`/`ContextId`" a failure mode the way minting your own
 * `HumanId` authorization was for that project's `halt`/`forced` — these
 * are plain identity, not a stand-in for a human's consent.
 */

declare const invariantIdBrand: unique symbol;
export type InvariantId = string & { readonly [invariantIdBrand]: "InvariantId" };
export function invariantId(raw: string): InvariantId {
  return raw as InvariantId;
}

declare const behaviorDeltaIdBrand: unique symbol;
export type BehaviorDeltaId = string & { readonly [behaviorDeltaIdBrand]: "BehaviorDeltaId" };
export function behaviorDeltaId(raw: string): BehaviorDeltaId {
  return raw as BehaviorDeltaId;
}

declare const contextIdBrand: unique symbol;
export type ContextId = string & { readonly [contextIdBrand]: "ContextId" };
export function contextId(raw: string): ContextId {
  return raw as ContextId;
}
