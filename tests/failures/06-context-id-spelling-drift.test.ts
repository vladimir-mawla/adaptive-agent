import { describe, expect, it } from "vitest";
import { proposeDelta } from "../../domains/support-triage/knobs.js";
import { evaluateDelta } from "../../domains/support-triage/scenario.js";
import { episode, SAME_TICKET_FIVE_SPELLINGS, VACANT } from "./helpers.js";

/**
 * ============================================================
 * CASE 6 — contextId SPELLING DRIFT (the strongest candidate this account
 * was asked to pin: case, whitespace, zero-width, and NFC/NFD variants
 * all count as DISTINCT contexts)
 * ============================================================
 * KIND: DISCLOSES A REAL, UNSOLVED GAP.
 *
 * THE GAP, STATED PLAINLY: `lib/contracts/ids.ts` declares `ContextId` an
 * opaque identity token with "NO PARSERS" (that file's own header), and
 * `lib/evidence/tally.ts` dedups with `new Set(...).size` — plain,
 * exact-codepoint `===` equality. `.genesis/decisions/0003-evidence.md`
 * (M3's own ADR) names this directly as "A DIFFERENT, MORE DANGEROUS GAP":
 * a single real ticket, logged as three or four spellings of its own id —
 * no forging, no hostile getter, just one caller or integration being
 * inconsistent — clears `distinctContexts: 3` or `4` exactly as if that
 * many genuinely independent contexts had reported in. This project's own
 * M6 demo already shows THREE of these variants live (case + whitespace)
 * at Step 7 of `npm run demo:triage`; this case demonstrates the FULL
 * breadth disclosed in the ADR — all four mechanisms in one pool,
 * including the two `npm run demo:triage`/`scenario.ts` do NOT show:
 * an invisible zero-width character, and Unicode normalization form
 * (NFC vs. NFD) — through the complete real pipeline, on a fresh delta.
 *
 * WHY THIS IS NOT, AND CANNOT BE, "FIXED" BY THIS TEST FILE: normalizing
 * (case-folding, trimming, stripping zero-width characters, calling
 * `.normalize("NFC")`) before building the `Set` would mean `lib/evidence`
 * inventing a canonicalization policy for an id type `lib/contracts`
 * deliberately declares has none — `lib/**` is FROZEN for this milestone,
 * and even if it were not, the correct owner of id canonicalization is
 * whichever caller MINTS `ContextId` values (a real ticketing
 * integration), not this pure counting function. This test exists to pin
 * the gap so a later milestone finds it documented and demonstrated, not
 * to close it.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED):
 * `lib/evidence/tally.ts` normalizing/canonicalizing `contextId` before
 * building its `Set` — at which point this test's own first assertion
 * (five distinct raw strings) would still hold, but its second assertion
 * (`distinctContexts === 5`, not 1) would start failing, and this file's
 * header would need to change from DISCLOSES to a retired/PROVES case.
 */
describe("CASE 6 (DISCLOSES): contextId spelling drift — one real ticket, five spellings, five contexts", () => {
  it("confirms the five spellings are genuinely distinct JavaScript strings — this is not a test artifact, it is plain === semantics", () => {
    const { plain, upperCase, trailingWhitespace, zeroWidthSuffix, nfdVariant } = SAME_TICKET_FIVE_SPELLINGS;
    const all = [plain, upperCase, trailingWhitespace, zeroWidthSuffix, nfdVariant];
    expect(new Set(all).size).toBe(5);
    // Canonically equivalent Unicode, not equal under === (widened to
    // `string` first — TS would otherwise flag two DIFFERENT string
    // LITERAL types as "no overlap" and refuse to compile the comparison
    // at all, which is itself a correct, if initially surprising, signal
    // that the two are statically known-distinct literals).
    expect(nfdVariant.normalize("NFC")).toBe(plain);
    const widenedPlain: string = plain;
    const widenedNfd: string = nfdVariant;
    expect(widenedNfd === widenedPlain).toBe(false);
  });

  it("all five spellings of ONE real ticket, through the full pipeline, clear MIN_DISTINCT_CONTEXTS_ADOPT and resolve adopt — purely from spelling drift, no genuine corroboration", () => {
    const delta = proposeDelta({
      id: "failure-case-6-delta",
      knob: "response-directness",
      from: 0.3,
      to: 0.55,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const { plain, upperCase, trailingWhitespace, zeroWidthSuffix, nfdVariant } = SAME_TICKET_FIVE_SPELLINGS;
    const oneTicketFiveWays = [plain, upperCase, trailingWhitespace, zeroWidthSuffix, nfdVariant].map((ctx) =>
      episode(delta.id, ctx, "helped"),
    );

    const result = evaluateDelta(delta, oneTicketFiveWays, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
    expect(result.decision.kind === "adopt" && result.decision.tally.distinctContexts).toBe(5);
  });

  it("CONTROL, isolating the zero-width and NFC/NFD mechanisms specifically (the two demo/scenario.ts does not already show): those two spellings ALONE already clear the bar together with one plain spelling", () => {
    const delta = proposeDelta({
      id: "failure-case-6-control",
      knob: "response-directness",
      from: 0.3,
      to: 0.55,
      proposedAt: "2026-03-01T00:00:00Z",
    });
    const { plain, zeroWidthSuffix, nfdVariant } = SAME_TICKET_FIVE_SPELLINGS;
    const threeWays = [plain, zeroWidthSuffix, nfdVariant].map((ctx) => episode(delta.id, ctx, "helped"));
    const result = evaluateDelta(delta, threeWays, VACANT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.kind).toBe("adopt");
    expect(result.decision.kind === "adopt" && result.decision.tally.distinctContexts).toBe(3);
  });
});
