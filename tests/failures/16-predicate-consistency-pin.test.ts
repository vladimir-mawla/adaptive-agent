import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const gateSource = readFileSync(path.join(repoRoot, "lib", "invariants", "gate.ts"), "utf-8");
const arbitrateSource = readFileSync(path.join(repoRoot, "lib", "arbitrate", "arbitrate.ts"), "utf-8");

/**
 * ============================================================
 * CASE 16 — THE DUPLICATED `invariant.knob === delta.knob` PREDICATE:
 * A PINNING TEST FOR THE COUPLING RISK `.genesis/decisions/
 * 0007-failure-suite.md` PREVIOUSLY DISCLOSED BUT DID NOT PIN
 * ============================================================
 * KIND: PINS THAT TWO INDEPENDENT, TEXTUALLY SEPARATE IMPLEMENTATIONS OF
 * THE SAME MATCHING RULE STILL AGREE TODAY. Not a PROVES-a-refusal case
 * (nothing is refused here) and not quite a DISCLOSES-a-gap case in the
 * usual sense (the gap — that these two could silently drift apart — is
 * disclosed in prose in `.genesis/decisions/0005-arbitration.md` Decision
 * 1 and `0007-failure-suite.md`'s own "Finding 4" table) — this is the
 * PIN itself: a test that fails the moment the two predicates stop
 * agreeing, closing the gap L4 VERIFY named directly: "a pinning test was
 * available without touching frozen code... 'we could not falsify it' is
 * true but is not the same as 'we could not pin it.'"
 *
 * WHY A PIN IS POSSIBLE HERE EVEN THOUGH FALSIFYING THE DRIFT ITSELF IS
 * NOT: this milestone cannot make the two predicates ACTUALLY DIVERGE
 * without editing FROZEN `lib/invariants/gate.ts` or FROZEN
 * `lib/arbitrate/arbitrate.ts` and leaving that edit in place, which is
 * out of this milestone's authority. But this milestone CAN assert,
 * today, that the two predicates are structurally identical RIGHT NOW,
 * in a way that stays checkable going forward: if a later, authorized
 * edit to either file's own matching rule ever changes what "the same
 * knob" means (e.g. normalizing case, trimming whitespace, matching on
 * more than one field), this test fails at that edit, not silently much
 * later when `arbitrate.ts`'s own "inconsistent gateResult/
 * invariantRegistry pair" throw fires for a delta a human would consider
 * legitimately frozen (the actual failure mode 0005-arbitration.md
 * warns about).
 *
 * THE MECHANISM, PRECISELY: `gate.ts`'s own predicate is
 * `invariant.knob === delta.knob` (a direct comparison against the
 * delta's own field). `arbitrate.ts`'s `findInvariantForKnob` predicate
 * is `invariant.knob === knob` (compared against its OWN `knob`
 * parameter, not `delta.knob` directly, because that helper is written
 * generically). The two are the SAME comparison today only because
 * `arbitrate`'s one call site binds that parameter with `delta.knob`
 * (`findInvariantForKnob(invariantRegistry, delta.knob)`). This test
 * checks all three textual facts together — gate's own predicate,
 * arbitrate's own internal predicate, and the call-site binding — so
 * that a drift in ANY of the three (not just the two predicate bodies
 * considered alone) is caught.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT A REAL DRIFT WOULD LOOK LIKE): any
 * authorized future edit to `gate.ts`'s own matching rule (e.g. adding
 * `.toLowerCase()` to either side), OR to `findInvariantForKnob`'s own
 * predicate, OR to its call site's argument, without an equivalent,
 * deliberate update to the other side. PROVEN FOR REAL, not merely
 * argued: `gate.ts`'s predicate was temporarily changed to
 * `invariant.knob.toLowerCase() === delta.knob` (minimal, uncompensated)
 * and this file's first test failed exactly as predicted (`match` became
 * `null`); separately, `arbitrate.ts`'s call site was temporarily changed
 * to `findInvariantForKnob(invariantRegistry, delta.knob as KnobId)` and
 * this file's third test failed exactly as predicted. Both sabotages
 * were restored byte-for-byte (`diff` against a pre-sabotage backup
 * returned no output) before any commit in this milestone — see
 * `.genesis/decisions/0007-failure-suite.md`'s own falsifiability log for
 * the full record.
 */
describe("CASE 16 (PINS a coupling risk): gate's and arbitrate's own knob-matching predicates agree today, checked structurally, not merely asserted", () => {
  it("gate.ts's own predicate compares invariant.knob against delta.knob directly", () => {
    const match = gateSource.match(/if\s*\(\s*invariant\.knob\s*===\s*([\w.]+)\s*\)\s*return\s*"frozen"/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("delta.knob");
  });

  it("arbitrate.ts's findInvariantForKnob predicate compares invariant.knob against its own second parameter", () => {
    const signatureMatch = arbitrateSource.match(
      /function\s+findInvariantForKnob<[^>]*>\s*\(\s*registry:[^,]+,\s*([\w]+):\s*KnobId\s*,?\s*\)/,
    );
    expect(signatureMatch).not.toBeNull();
    const paramName = signatureMatch?.[1];
    expect(paramName).toBe("knob");

    const predicateMatch = arbitrateSource.match(/if\s*\(\s*invariant\.knob\s*===\s*([\w.]+)\s*\)\s*return\s*invariant\.id/);
    expect(predicateMatch).not.toBeNull();
    expect(predicateMatch?.[1]).toBe(paramName);
  });

  it("arbitrate.ts's ONE call site binds that parameter with delta.knob — the fact that makes the two predicates above the IDENTICAL comparison today", () => {
    const callSiteMatch = arbitrateSource.match(/findInvariantForKnob\s*\(\s*invariantRegistry\s*,\s*([\w.]+)\s*\)/);
    expect(callSiteMatch).not.toBeNull();
    expect(callSiteMatch?.[1]).toBe("delta.knob");
  });

  it("there is exactly one call site — confirming this is not one of several bindings this test would need to check", () => {
    const occurrences = arbitrateSource.match(/findInvariantForKnob/g) ?? [];
    // Exactly two occurrences of the identifier in the whole file: the one
    // function declaration (`function findInvariantForKnob<...>(...)`) and
    // the one call site (`findInvariantForKnob(invariantRegistry,
    // delta.knob)`) already checked above — never a second call site this
    // test would otherwise miss.
    expect(occurrences.length).toBe(2);
  });
});
