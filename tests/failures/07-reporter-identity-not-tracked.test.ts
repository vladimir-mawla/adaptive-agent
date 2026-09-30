import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { distinctContextEpisodes, VACANT } from "./helpers.js";

/**
 * ============================================================
 * CASE 7 — SOURCE-DIVERSITY / REPORTER IDENTITY IS NOT CHECKED, ONLY
 * contextId IS (`.genesis/PLAN.md` §4, case 6, verbatim)
 * ============================================================
 * KIND: DISCLOSES A REAL, UNSOLVED GAP.
 *
 * THE GAP, STATED PLAINLY, AND DISTINCT FROM CASE 6: case 6 is about the
 * SAME real context, spelled inconsistently, counting as several. This
 * case is the opposite, equally real concern the plan itself names: one
 * customer opening FIVE genuinely different real tickets (five distinct,
 * cleanly-spelled `contextId`s — no spelling drift anywhere in this
 * case) about the same underlying complaint satisfies
 * `MIN_DISTINCT_CONTEXTS_ADOPT` exactly as if five different customers
 * had each opened one. This system has no notion of "reporter identity"
 * distinct from "context" anywhere in its vocabulary
 * (`lib/contracts/episode.ts`'s own `Episode` shape has no
 * `reporterId`/`customerId` field at all) — this case exists to prove
 * that gap is real, not to claim it is closed.
 *
 * WHY THIS IS NOT THIS SYSTEM'S TO FIX: `.genesis/PLAN.md` §4 case 6 names
 * this as "disclosed, not fixed" from the plan's own original sketch —
 * adding a reporter-identity dimension would be a new load-bearing field
 * on `Episode` (M1, FROZEN) and a new corroboration axis in `lib/evidence`
 * (M3, FROZEN) neither of which this milestone has authority to add.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED):
 * `Episode` gaining a `reporterId`-shaped field and `lib/evidence.tally`
 * additionally requiring distinct REPORTERS, not merely distinct
 * contexts, to clear the adopt bar — at which point this exact scenario
 * (one reporter, five tickets) would resolve `hold`, not `adopt`.
 */
describe("CASE 7 (DISCLOSES): one customer's five distinct tickets satisfy the corroboration bar identically to five distinct customers", () => {
  it("five genuinely distinct, cleanly-spelled contextIds — all traceable to ONE real customer, by this scenario's own construction — resolve adopt", () => {
    const delta = proposeDelta({
      id: "failure-case-7-delta",
      knob: "escalation-aggressiveness",
      from: 0.5,
      to: 0.85,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    // Five real, distinct ticket ids — no spelling drift (case 6's concern)
    // anywhere here — all opened by the SAME one customer (a fact this
    // system has nowhere to record or check; the prefix is for this test's
    // own readability only, not a field any production code reads).
    const oneCustomerFiveTickets = distinctContextEpisodes(delta.id, "tck-customer-42-ticket", "helped", 5);
    const result = evaluateDelta(delta, oneCustomerFiveTickets, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
    expect(result.decision.kind === "adopt" && result.decision.tally.distinctContexts).toBe(5);
  });

  it("CONTROL, proving the decision is genuinely indistinguishable from five different customers: the identical episode shape, differently prefixed to suggest five different customers, resolves the exact same decision", () => {
    const delta = proposeDelta({
      id: "failure-case-7-control",
      knob: "escalation-aggressiveness",
      from: 0.5,
      to: 0.85,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const fiveDifferentCustomers = distinctContextEpisodes(delta.id, "tck-many-customers-ticket", "helped", 5);
    const result = evaluateDelta(delta, fiveDifferentCustomers, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Both scenarios, one-customer and many-customer, produce structurally
    // identical decisions (same kind, same tally shape) — the system has
    // no way to tell them apart, which is exactly the gap this case pins.
    expect(result.decision.kind).toBe("adopt");
    expect(result.decision.kind === "adopt" && result.decision.tally.distinctContexts).toBe(5);
  });
});
