import { describe, expect, it } from "vitest";
import type { EvidenceTally } from "../evidence-tally.js";
import { behaviorDeltaId } from "../ids.js";

const DELTA = behaviorDeltaId("delta-1");

describe("EvidenceTally.distinctContexts is its own field, never derived from helped+neutral+harmed", () => {
  it("constructs a tally where distinctContexts diverges from the sum of the three outcome counts", () => {
    // The exact shape plan §3 (M3) requires be representable: 200 episodes,
    // all "helped", all from one contextId -> distinctContexts: 1.
    const tally: EvidenceTally = { deltaId: DELTA, distinctContexts: 1, helped: 200, neutral: 0, harmed: 0 };
    expect(tally.distinctContexts).toBe(1);
    expect(tally.helped).toBe(200);
  });

  it("TYPE-LEVEL: a non-numeric distinctContexts does not compile", () => {
    const tally: EvidenceTally = {
      deltaId: DELTA,
      // @ts-expect-error — distinctContexts must be a number, never a boolean or string standing in for a count.
      distinctContexts: "one",
      helped: 1,
      neutral: 0,
      harmed: 0,
    };
    expect(tally).toBeDefined();
  });

  it("TYPE-LEVEL: missing deltaId does not compile", () => {
    // @ts-expect-error — a tally must name which delta it summarizes evidence for.
    const tally: EvidenceTally = { distinctContexts: 1, helped: 1, neutral: 0, harmed: 0 };
    expect(tally).toBeDefined();
  });
});
