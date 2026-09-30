import { describe, expect, it, vi, afterEach } from "vitest";

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
