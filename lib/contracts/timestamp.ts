/**
 * `Timestamp` — a branded identity for "this string names an instant",
 * used by `BehaviorDelta.proposedAt` and `Episode.observedAt`.
 *
 * NOT NAMED IN THE PLAN'S OWN M1 "Files it owns" LIST either — see
 * `ids.ts`'s header and `.genesis/decisions/0001-contracts.md` for the
 * same flagged omission. `BehaviorDelta.proposedAt` and
 * `Episode.observedAt` are both named directly in plan §2's own prose, and
 * neither can be typed without this file.
 *
 * NO ORDERING OR FORMAT VALIDATION, DELIBERATELY: unlike a project that
 * needs `now`-relative freshness math at this layer, this milestone's own
 * plan is explicit that `EvidenceTally` carries no time dimension at all —
 * failure case 7 (`.genesis/PLAN.md` §4): "`lib/evidence/tally.ts` never
 * reads `observedAt` for anything but display... a deliberate, disclosed
 * non-goal." A parser or a "must not be later than now" constructor check
 * would invent a rule this milestone has no consumer to justify — the same
 * "don't build validation ahead of a real need" discipline
 * `agent-control-tower`'s own `timestamp.ts` documents for the identical
 * reason. This file only tags a string as "this is meant to be an
 * instant" and stops there; if a later milestone ever needs ordering or
 * freshness math, that logic belongs next to the code that consumes it,
 * not pre-built here on spec.
 *
 * Minting matches `ids.ts`'s pattern: an opaque token, no invariant beyond
 * "is a string," one blessed constructor that owns only the brand.
 */
declare const timestampBrand: unique symbol;
export type Timestamp = string & { readonly [timestampBrand]: "Timestamp" };

export function timestamp(raw: string): Timestamp {
  return raw as Timestamp;
}
