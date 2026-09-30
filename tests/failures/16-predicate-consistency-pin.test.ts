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
 * A NARROW, SOURCE-READ PIN ON THREE SPECIFIC TEXTUAL FACTS — NOT A
 * BEHAVIORAL-EQUIVALENCE PROOF FOR `gate()` AND `findInvariantForKnob()`
 * AS FUNCTIONS
 * ============================================================
 * KIND: PINS THREE NAMED TEXTUAL FACTS THAT, TOGETHER, FULLY EXPLAIN WHY
 * `gate.ts`'s predicate and `arbitrate.ts`'s `findInvariantForKnob`
 * predicate produce the SAME answer TODAY. Not a PROVES-a-refusal case
 * (nothing is refused here) and not quite a DISCLOSES-a-gap case in the
 * usual sense (the gap — that these two could silently drift apart — is
 * disclosed in prose in `.genesis/decisions/0005-arbitration.md` Decision
 * 1 and `0007-failure-suite.md`'s own "Finding 4" table) — this is the
 * PIN itself.
 *
 * STATED AT EXACTLY THE STRENGTH IT HOLDS, AFTER A ROUND-2 L4 VERIFY
 * FINDING CORRECTED AN OVERCLAIM IN THIS FILE'S OWN EARLIER DRAFT: an
 * earlier version of this header described the four tests below as
 * confirming the two predicates "still agree... checked structurally,
 * not merely asserted" — phrasing that reads as full BEHAVIORAL
 * equivalence between `gate()` and `findInvariantForKnob()` as functions.
 * **That is not what a regex over three specific matched expressions can
 * deliver, and L4 VERIFY falsified the overclaim directly**: an early-
 * return guard clause was inserted INSIDE `gate()`, before its loop —
 * `if (delta.knob === "__attack_bypass__") return "eligible";` — a change
 * that makes `gate()` and `findInvariantForKnob()` genuinely disagree for
 * that one input, while leaving the regex-matched line
 * (`invariant.knob === delta.knob`) completely untouched. Reproduced
 * directly: with that guard clause in place, the FULL suite (342 tests,
 * including all four of THIS file's own assertions) passed silently —
 * this pin cannot see a divergence that lives outside the three
 * expressions it actually reads.
 *
 * WHAT THIS PIN ACTUALLY CHECKS, AND NO MORE: exactly three textual
 * facts, named precisely in "THE MECHANISM" below — gate's own
 * `invariant.knob === delta.knob` line, arbitrate's own internal
 * `invariant.knob === knob` line, and the one call site binding `knob` to
 * `delta.knob`. Together these three facts fully explain why the two
 * functions agree on every input reachable through arbitrate's one call
 * site TODAY. They do NOT, and cannot, prove the two functions agree on
 * every possible input in general — a change anywhere else in either
 * function's body (an added branch, a guard clause, a second condition)
 * is invisible to a pin built this way, by construction, because it never
 * reads those lines at all.
 *
 * WHY A PIN OF THIS SHAPE IS WHAT'S AVAILABLE HERE, AND WHY STRONGER
 * ISN'T: a genuine behavioral-equivalence check (e.g. property-based
 * fuzzing both functions against the same random inputs and diffing
 * their outputs) is not available without exporting `findInvariantForKnob`
 * — it is private to FROZEN `lib/arbitrate/arbitrate.ts`, and adding an
 * export is out of this milestone's authority. Nor can this milestone
 * make the two predicates actually diverge and leave that in place to
 * prove a negative test would catch it — that too requires editing
 * FROZEN `gate.ts` or `arbitrate.ts` permanently. What remains, and what
 * this file actually does: assert the three textual facts above hold
 * right now, in a way that DOES catch drift in any of those three
 * specific expressions (proven below), while disclosing plainly that it
 * catches nothing outside them — narrower than "we could not falsify the
 * drift" might suggest, but not nothing, which is the distinction L4
 * VERIFY's own brief drew between falsifying and pinning.
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
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT A REAL DRIFT IN ONE OF THOSE
 * THREE EXPRESSIONS WOULD LOOK LIKE): any authorized future edit to
 * `gate.ts`'s own matching LINE (e.g. adding `.toLowerCase()` to either
 * side), OR to `findInvariantForKnob`'s own predicate LINE, OR to its
 * call site's argument, without an equivalent, deliberate update to the
 * other side. PROVEN FOR REAL, not merely argued: `gate.ts`'s predicate
 * was temporarily changed to `invariant.knob.toLowerCase() === delta.knob`
 * (minimal, uncompensated) and this file's first test failed exactly as
 * predicted (`match` became `null`); separately, `arbitrate.ts`'s call
 * site was temporarily changed to `findInvariantForKnob(invariantRegistry,
 * delta.knob as KnobId)` and this file's third test failed exactly as
 * predicted. Both sabotages were restored byte-for-byte (`diff` against a
 * pre-sabotage backup returned no output) before any commit in this
 * milestone. WHAT WOULD NOT MAKE THIS FAIL, DEMONSTRATED ABOVE, NOT
 * MERELY ARGUED: a guard clause or any other branch added ANYWHERE ELSE
 * in either function's body, touching neither of the two matched lines
 * nor the call site — this pin is silent to that class of change by
 * construction, and a reader relying on this file alone should not infer
 * otherwise. See `.genesis/decisions/0007-failure-suite.md`'s own
 * falsifiability log for the full record of both classes of experiment.
 */
describe("CASE 16 (PINS three named textual facts, not full behavioral equivalence): gate's and arbitrate's own knob-matching LINES agree today", () => {
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
