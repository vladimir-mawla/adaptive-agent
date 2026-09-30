import { describe, expect, it, vi, afterEach } from "vitest";
import { assertFrozenCitesNoEvidence } from "../../contracts/adaptation-decision.js";
import { behaviorDeltaId, invariantId } from "../../contracts/index.js";
import type { FrozenDecision } from "../../contracts/adaptation-decision.js";

/**
 * `assertFrozenCitesNoEvidence` IS BEHAVIORALLY LOAD-BEARING, NOT JUST
 * TEXTUALLY PRESENT — `__tests__/architecture.test.ts` proves the call
 * appears in the shipped source; this file proves what happens when that
 * check actually reports a failure, the case the clean construction path
 * in `arbitrate.ts` can never trigger on its own (it only ever builds a
 * fresh `{ kind: "frozen", deltaId, invariant }` literal with no evidence
 * field to begin with). `lib/contracts/adaptation-decision.js` is mocked
 * here to FORCE the failing branch — the only way to exercise "refuse to
 * trust one that fails it" for real, since the true residual this guard
 * exists for (a deliberate cast or an `any` from `JSON.parse`, per
 * `0001-contracts.md`) is exactly the kind of thing this function's own
 * clean, cast-free construction sites (see `architecture.test.ts`'s
 * no-cast scan) never produce today.
 */
describe("arbitrate refuses to trust a frozen decision that fails assertFrozenCitesNoEvidence", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("throws, citing the integrity error, when the guard reports contamination", async () => {
    vi.doMock("../../contracts/adaptation-decision.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../../contracts/adaptation-decision.js")>();
      return {
        ...actual,
        assertFrozenCitesNoEvidence: () => ({
          ok: false,
          error: { kind: "unexpected-evidence-on-frozen", field: "tally", received: "forged" },
        }),
      };
    });

    const { arbitrate } = await import("../arbitrate.js");
    const { behaviorDeltaId, invariantId, timestamp } = await import("../../contracts/index.js");
    const { createInvariantRegistry } = await import("../../invariants/gate.js");

    const delta = {
      id: behaviorDeltaId("d1"),
      knob: "auto-refund-ceiling" as const,
      from: 500,
      to: 5000,
      proposedAt: timestamp("2026-09-30T00:00:00Z"),
    };
    const registry = createInvariantRegistry([
      { id: invariantId("i1"), knob: "auto-refund-ceiling" as const, description: "never adaptable" },
    ]);
    const tally = { deltaId: delta.id, distinctContexts: 0, helped: 0, neutral: 0, harmed: 0 };

    expect(() => arbitrate(delta, tally, "frozen", { kind: "vacant" }, registry)).toThrow(
      /refusing to trust a frozen decision that failed assertFrozenCitesNoEvidence/,
    );
  });
});

/**
 * THE ONE RESIDUAL ROUTE THIS MILESTONE'S OWN NO-CAST SCAN (architecture.
 * test.ts) STRUCTURALLY CANNOT CATCH, PROVEN DIRECTLY RATHER THAN ONLY
 * ASSERTED — flagged by L4 VERIFY as worth recording: the scan looks for
 * the literal `as` keyword; `JSON.parse` returns `any`, so a value can
 * arrive at a `FrozenDecision`-typed binding fully contaminated with a
 * populated `tally` field with NO cast syntax anywhere in the line for any
 * text scan to find. This is exactly the residual `0001-contracts.md`
 * names for `AdaptationDecision` generally, reproduced here for real
 * against the actual, frozen `assertFrozenCitesNoEvidence` (not a mock) —
 * and it still catches it. This is the layered design working exactly as
 * M1's ADR intended: the type system (M1) closes seven reported
 * construction routes, the no-cast scan (this milestone) proves none of
 * THIS milestone's own code needs the one residual route type-checking
 * cannot close, and this runtime guard is what is left standing between a
 * value that reaches `arbitrate` through that residual anyway (e.g. a
 * `frozen` decision deserialized from a log, a queue, or another process)
 * and a silent, evidence-contaminated `frozen` ruling.
 */
describe("assertFrozenCitesNoEvidence catches a value contaminated via JSON.parse — no 'as' cast anywhere, the one route the no-cast scan cannot see", () => {
  it("a FrozenDecision round-tripped through JSON.parse(JSON.stringify(...)), carrying a populated tally, is caught for real by the actual (non-mocked) guard", () => {
    const contaminatedSource = {
      kind: "frozen",
      deltaId: behaviorDeltaId("d1"),
      invariant: invariantId("i1"),
      tally: { deltaId: behaviorDeltaId("d1"), distinctContexts: 10_000, helped: 10_000, neutral: 0, harmed: 0 },
    };
    // No `as`/`as unknown as` anywhere on this line — JSON.parse's own
    // return type is `any`, which is assignable to FrozenDecision with no
    // cast keyword for a text scan to ever find.
    const forged: FrozenDecision = JSON.parse(JSON.stringify(contaminatedSource));

    const integrity = assertFrozenCitesNoEvidence(forged);
    expect(integrity.ok).toBe(false);
    if (!integrity.ok) {
      expect(integrity.error.field).toBe("tally");
      expect(integrity.error.kind).toBe("unexpected-evidence-on-frozen");
    }
  });
});
