import { describe, expect, it } from "vitest";
import type { AdaptationDecision, FrozenDecision } from "../adaptation-decision.js";
import { assertFrozenCitesNoEvidence, assertNeverAdaptationDecision } from "../adaptation-decision.js";
import { behaviorDeltaId, invariantId } from "../ids.js";

const DELTA = behaviorDeltaId("delta-1");
const INVARIANT = invariantId("auto-refund-ceiling");
const TALLY = { deltaId: DELTA, distinctContexts: 3, helped: 3, neutral: 0, harmed: 0 };

/**
 * ROUND 2 — L4 VERIFY rejected this milestone's original claim here
 * ("frozen structurally excludes a tally — unsayable, not merely
 * unchecked"): that claim rested entirely on TypeScript's excess-property
 * check, which applies only to a FRESH object literal written directly at
 * an assignment/argument/array-element site. Seven routes that are not
 * fresh literals all compiled clean against the original type. The fix
 * (adaptation-decision.ts: `tally?: never`, `distinctContextsNeeded?:
 * never`, `revertedTo?: never` on `frozen`) closes ALL SEVEN of the
 * originally reported routes, including the `satisfies`-based one
 * (`TS1360`). A DIFFERENT construct, never one of the seven reported — an
 * explicit `as`/`as unknown as` cast, or an implicit `any` value arriving
 * from a library call such as `JSON.parse` — remains open, as a disclosed
 * example of a language-level property (every TypeScript type falls to a
 * deliberate cast or an `any`, not something particular to this design),
 * not a gap this suite pretends is closed. See adaptation-decision.ts's
 * own "ROUND 2" header for the full incident.
 */
describe("AdaptationDecision.frozen refuses tally/distinctContextsNeeded/revertedTo through all seven reported routes", () => {
  it("constructs a valid frozen decision with no evidence fields", () => {
    const frozen: AdaptationDecision = { kind: "frozen", deltaId: DELTA, invariant: INVARIANT };
    expect(frozen.kind).toBe("frozen");
    expect("tally" in frozen).toBe(false);
  });

  it("TYPE-LEVEL: a fresh frozen literal carrying a tally does not compile", () => {
    // @ts-expect-error — a real EvidenceTally is not assignable to `tally?: never` on `frozen`.
    const frozen: AdaptationDecision = { kind: "frozen", deltaId: DELTA, invariant: INVARIANT, tally: TALLY };
    expect(frozen).toBeDefined();
  });

  it("TYPE-LEVEL: a fresh frozen literal carrying distinctContextsNeeded does not compile", () => {
    const frozen: AdaptationDecision = {
      kind: "frozen",
      deltaId: DELTA,
      invariant: INVARIANT,
      // @ts-expect-error — distinctContextsNeeded is `never` on `frozen`: it is an evidence-summary field, not a knob-identity field.
      distinctContextsNeeded: 2,
    };
    expect(frozen).toBeDefined();
  });

  it("TYPE-LEVEL: a fresh frozen literal carrying revertedTo does not compile", () => {
    // @ts-expect-error — revertedTo is `never` on `frozen`: a frozen decision never rolls a knob back because it never moved it.
    const frozen: AdaptationDecision = { kind: "frozen", deltaId: DELTA, invariant: INVARIANT, revertedTo: "x" };
    expect(frozen).toBeDefined();
  });

  // A single value carrying all three evidence fields at once, so no test
  // below can accidentally pass because it only exercises a field a
  // narrower fix happened to cover.
  const sneaky = {
    kind: "frozen" as const,
    deltaId: DELTA,
    invariant: INVARIANT,
    tally: TALLY,
    distinctContextsNeeded: 2,
    revertedTo: "x",
  };

  function identity<T>(x: T): T {
    return x;
  }

  it("TYPE-LEVEL route 1/6 — intermediate binding does not compile", () => {
    // @ts-expect-error — assigning a pre-built object carrying evidence fields fails on assignability, not just on a fresh literal.
    const a: AdaptationDecision = sneaky;
    expect(a).toBeDefined();
  });

  it("TYPE-LEVEL route 2/6 — spread does not compile", () => {
    // @ts-expect-error — spreading `sneaky` still carries its evidence fields into the assigned value.
    const b: AdaptationDecision = { ...sneaky };
    expect(b).toBeDefined();
  });

  it("TYPE-LEVEL route 3/6 — function return does not compile", () => {
    function f(): AdaptationDecision {
      // @ts-expect-error — returning `sneaky` is checked the same as assigning it.
      return sneaky;
    }
    expect(f).toBeDefined();
  });

  it("TYPE-LEVEL route 4/6 — generic helper does not compile", () => {
    // @ts-expect-error — a generic identity helper does not launder the evidence fields past assignability.
    const d: AdaptationDecision = identity(sneaky);
    expect(d).toBeDefined();
  });

  it("TYPE-LEVEL route 5/6 — Object.assign does not compile", () => {
    // @ts-expect-error — Object.assign's result still structurally carries the evidence fields.
    const e: AdaptationDecision = Object.assign({}, sneaky);
    expect(e).toBeDefined();
  });

  it("TYPE-LEVEL route 6/6 — array element does not compile", () => {
    // @ts-expect-error — an array element is checked the same as a single assignment.
    const arr: AdaptationDecision[] = [sneaky];
    expect(arr).toBeDefined();
  });

  it("DOCUMENTATION/EXAMPLE, NOT A REGRESSION PIN: a deliberate `as unknown as` cast bypasses this, and is not claimed to be closed", () => {
    // NOT a regression test: `x as unknown as Y` is unconditionally
    // permitted by TypeScript between any two object shapes, so no change
    // to this codebase could ever make this line fail to compile — it
    // pins an immutable property of the language, not a fragile fact
    // about this file. It exists purely to illustrate, with a real,
    // running example, the one construct L4 VERIFY's own reported list
    // did NOT include and that this milestone does not claim to close at
    // the type level (see adaptation-decision.ts's "A DIFFERENT,
    // UNREPORTED RESIDUAL" paragraph). This test carries no ts-expect-error
    // marker (note the deliberately broken directive spelling in this
    // sentence, so this comment itself is never mistaken for one) since
    // it is meant to compile clean. assertFrozenCitesNoEvidence (tested
    // below) is the runtime guard this residual requires — recorded as a
    // build requirement for M5 in .genesis/decisions/0001-contracts.md.
    const cast = sneaky as unknown as AdaptationDecision;
    expect(cast.kind).toBe("frozen");
    expect((cast as typeof sneaky).tally).toEqual(TALLY);
  });
});

/**
 * L4 VERIFY's own question: "can an `adopt` be built carrying an
 * `invariant` field?" Checked, not assumed — yes, via the identical
 * non-literal-route mechanism, and this milestone deliberately does not
 * mirror `?: never` onto adopt/hold/revert to close it. See
 * adaptation-decision.ts's own header for the reasoning: only `frozen` is
 * named by the plan as needing to be structurally incapable of appearing
 * evidence-driven; adopt/hold/revert are already evidence-driven by their
 * own required `tally`, so a stray field from a different variant does
 * not create the same "misrepresents why it fired" risk.
 */
describe("HONEST LIMIT: adopt/hold/revert are not mirrored against carrying each other's fields (deliberate scope boundary)", () => {
  it("adopt can still carry a stray invariant field via a non-literal route today", () => {
    const sneakyAdopt = { kind: "adopt" as const, deltaId: DELTA, tally: TALLY, invariant: INVARIANT };
    const adopt: AdaptationDecision = sneakyAdopt;
    expect(adopt.kind).toBe("adopt");
    expect((adopt as typeof sneakyAdopt).invariant).toBe(INVARIANT);
  });

  it("hold can still carry a stray revertedTo field via a non-literal route today", () => {
    const sneakyHold = {
      kind: "hold" as const,
      deltaId: DELTA,
      tally: TALLY,
      distinctContextsNeeded: 2,
      revertedTo: "x",
    };
    const hold: AdaptationDecision = sneakyHold;
    expect(hold.kind).toBe("hold");
    expect((hold as typeof sneakyHold).revertedTo).toBe("x");
  });

  it("revert can still carry a stray distinctContextsNeeded field via a non-literal route today", () => {
    const sneakyRevert = {
      kind: "revert" as const,
      deltaId: DELTA,
      tally: TALLY,
      revertedTo: "x",
      distinctContextsNeeded: 2,
    };
    const revert: AdaptationDecision = sneakyRevert;
    expect(revert.kind).toBe("revert");
    expect((revert as typeof sneakyRevert).distinctContextsNeeded).toBe(2);
  });
});

/**
 * assertFrozenCitesNoEvidence — the runtime guard for the one residual
 * the type-level fix cannot close (a deliberate cast). Proven against a
 * genuine value (ok:true) and against three forged values, one per
 * evidence field, each built with the exact `as unknown as FrozenDecision`
 * cast the disclosed-residual test above demonstrates compiles clean.
 */
describe("assertFrozenCitesNoEvidence catches the disclosed cast residual at runtime", () => {
  it("returns ok:true for a genuine frozen decision", () => {
    const frozen: AdaptationDecision = { kind: "frozen", deltaId: DELTA, invariant: INVARIANT };
    expect(assertFrozenCitesNoEvidence(frozen as FrozenDecision)).toEqual({ ok: true });
  });

  it("catches a tally that arrived via the disclosed cast residual", () => {
    const forged = {
      kind: "frozen" as const,
      deltaId: DELTA,
      invariant: INVARIANT,
      tally: TALLY,
    } as unknown as FrozenDecision;
    expect(assertFrozenCitesNoEvidence(forged)).toEqual({
      ok: false,
      error: { kind: "unexpected-evidence-on-frozen", field: "tally", received: TALLY },
    });
  });

  it("catches a distinctContextsNeeded that arrived via the disclosed cast residual", () => {
    const forged = {
      kind: "frozen" as const,
      deltaId: DELTA,
      invariant: INVARIANT,
      distinctContextsNeeded: 2,
    } as unknown as FrozenDecision;
    expect(assertFrozenCitesNoEvidence(forged)).toEqual({
      ok: false,
      error: { kind: "unexpected-evidence-on-frozen", field: "distinctContextsNeeded", received: 2 },
    });
  });

  it("catches a revertedTo that arrived via the disclosed cast residual", () => {
    const forged = {
      kind: "frozen" as const,
      deltaId: DELTA,
      invariant: INVARIANT,
      revertedTo: "x",
    } as unknown as FrozenDecision;
    expect(assertFrozenCitesNoEvidence(forged)).toEqual({
      ok: false,
      error: { kind: "unexpected-evidence-on-frozen", field: "revertedTo", received: "x" },
    });
  });
});

describe("AdaptationDecision.hold carries a number of remaining distinct contexts, not a boolean or prose", () => {
  it("constructs a valid hold decision with a numeric distinctContextsNeeded", () => {
    const hold: AdaptationDecision = {
      kind: "hold",
      deltaId: DELTA,
      tally: TALLY,
      distinctContextsNeeded: 2,
    };
    expect(hold.distinctContextsNeeded).toBe(2);
    expect(typeof hold.distinctContextsNeeded).toBe("number");
  });

  it("TYPE-LEVEL: hold missing distinctContextsNeeded does not compile", () => {
    // @ts-expect-error — `distinctContextsNeeded: number` is required on `hold`; a decision that can't say how many more contexts are needed is a vague "not yet," which the plan refuses.
    const hold: AdaptationDecision = { kind: "hold", deltaId: DELTA, tally: TALLY };
    expect(hold).toBeDefined();
  });

  it("TYPE-LEVEL: hold with a boolean distinctContextsNeeded does not compile", () => {
    const hold: AdaptationDecision = {
      kind: "hold",
      deltaId: DELTA,
      tally: TALLY,
      // @ts-expect-error — `distinctContextsNeeded` must be a `number` a caller can act on, never a boolean standing in for "not yet."
      distinctContextsNeeded: true,
    };
    expect(hold).toBeDefined();
  });
});

describe("adopt/hold/revert must each cite the tally that licensed them", () => {
  it("TYPE-LEVEL: adopt missing tally does not compile", () => {
    // @ts-expect-error — `adopt` refuses to fire without citing the exact tally that licensed it.
    const adopt: AdaptationDecision = { kind: "adopt", deltaId: DELTA };
    expect(adopt).toBeDefined();
  });

  it("TYPE-LEVEL: revert missing tally does not compile", () => {
    // @ts-expect-error — `revert` refuses to fire without citing the exact tally that licensed it.
    const revert: AdaptationDecision = {
      kind: "revert",
      deltaId: DELTA,
      revertedTo: "conservative",
    };
    expect(revert).toBeDefined();
  });

  it("TYPE-LEVEL: revert missing revertedTo does not compile", () => {
    // @ts-expect-error — `revert` must state the value the knob rolled back to.
    const revert: AdaptationDecision = { kind: "revert", deltaId: DELTA, tally: TALLY };
    expect(revert).toBeDefined();
  });
});

/**
 * FALSIFIABILITY: `assertNeverAdaptationDecision` is a live exhaustiveness
 * guard, not decorative. Proven on a LOCAL five-kind stand-in union — never
 * by widening the real, frozen four-variant `AdaptationDecision` just to
 * make a point (same discipline `agent-control-tower`'s own
 * `intervention.test.ts` documents for `assertNeverIntervention`).
 *
 * This was actually broken and restored while writing this test: the
 * `"bogus"` case below was temporarily removed from the switch's handled
 * set (leaving only three of the four real-shaped cases plus no default),
 * `npm run typecheck` was run, and it failed with exactly the predicted
 * error — `assertNeverStandIn(decision)` no longer type-checked because
 * `decision` was narrowed to `{ kind: "bogus" }` in the unhandled branch,
 * which is not assignable to `never` (TS2345, "Argument of type '{ kind:
 * "bogus"; }' is not assignable to parameter of type 'never'."). Restoring
 * the case returned `typecheck` to clean. See this milestone's PR/report
 * for the transcript.
 */
type StandIn =
  | { kind: "adopt" }
  | { kind: "hold" }
  | { kind: "revert" }
  | { kind: "frozen" }
  | { kind: "bogus" };

function assertNeverStandIn(value: never): never {
  throw new Error(`Unreachable: ${JSON.stringify(value)}`);
}

function describeStandIn(decision: StandIn): string {
  switch (decision.kind) {
    case "adopt":
      return "adopt";
    case "hold":
      return "hold";
    case "revert":
      return "revert";
    case "frozen":
      return "frozen";
    case "bogus":
      return "bogus";
    default:
      return assertNeverStandIn(decision);
  }
}

describe("assertNeverAdaptationDecision is a live exhaustiveness guard", () => {
  it("handles every stand-in case today (mechanism proven live during development, see comment above)", () => {
    expect(describeStandIn({ kind: "adopt" })).toBe("adopt");
    expect(describeStandIn({ kind: "bogus" })).toBe("bogus");
  });

  it("the real assertNeverAdaptationDecision throws if ever reached at runtime (never expected to be, by construction)", () => {
    expect(() => assertNeverAdaptationDecision({ kind: "frozen", deltaId: DELTA, invariant: INVARIANT } as never)).toThrow(
      /Unreachable/,
    );
  });
});
