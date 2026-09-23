import { describe, expect, it } from "vitest";
import { tally } from "../tally.js";
import type { Episode } from "../../contracts/episode.js";
import { CONTEXTS, DELTA, episode } from "./fixtures.js";

/**
 * Plan §3 M3, "what it refuses": "to crash on a hostile `episodes` array
 * (a throwing getter, a `Proxy`)... fails closed to a typed tally-failure
 * value, never an uncaught exception." Falsifiability check, verbatim: "a
 * hostile-input test (`Proxy` that throws on every property access)
 * proves a typed failure, not a crash, is returned." Every test below
 * asserts BOTH halves of that: (1) `tally` itself never throws
 * (`expect(() => ...).not.toThrow()`), and (2) the returned value is the
 * SPECIFIC typed failure (`ok: false`, a named `kind`), not merely "some
 * object came back" — the exact "implication, not a real assertion" gap
 * this milestone's own task warns a prior sibling shipped.
 */

function throwingProxy<T extends object>(label: string): T {
  return new Proxy(
    {},
    {
      get(): never {
        throw new Error(`hostile Proxy trap: ${label}`);
      },
      has(): never {
        throw new Error(`hostile Proxy trap (has): ${label}`);
      },
      ownKeys(): never {
        throw new Error(`hostile Proxy trap (ownKeys): ${label}`);
      },
    },
  ) as unknown as T;
}

function throwingGetterEpisode(field: "deltaId" | "contextId" | "outcome"): Episode {
  const base: Record<string, unknown> = {
    deltaId: "delta-escalation-aggressiveness",
    contextId: "ticket-a",
    outcome: "helped",
    observedAt: "2026-09-23T00:00:00.000Z",
  };
  Object.defineProperty(base, field, {
    get(): never {
      throw new Error(`hostile getter: ${field}`);
    },
    enumerable: true,
  });
  return base as unknown as Episode;
}

describe("tally — a Proxy episodes array that throws on every access never crashes the process", () => {
  it("returns a typed hostile-episodes-input failure, not an uncaught exception", () => {
    const hostileEpisodes = throwingProxy<readonly Episode[]>("episodes-array");
    let result: ReturnType<typeof tally> | undefined;
    expect(() => {
      result = tally(DELTA, hostileEpisodes);
    }).not.toThrow();
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: "hostile-episodes-input" }) });
  });
});

describe("tally — a throwing getter on a single episode, inside an otherwise ordinary array, never crashes the process", () => {
  it("a throwing deltaId getter returns the typed hostile-episodes-input failure and names the field in its message", () => {
    const episodes = [episode(DELTA, CONTEXTS.a, "helped"), throwingGetterEpisode("deltaId")];
    let result: ReturnType<typeof tally> | undefined;
    expect(() => {
      result = tally(DELTA, episodes);
    }).not.toThrow();
    expect(result?.ok).toBe(false);
    if (result?.ok !== false) throw new Error("unreachable");
    expect(result.error.kind).toBe("hostile-episodes-input");
    if (result.error.kind !== "hostile-episodes-input") throw new Error("unreachable");
    expect(result.error.message).toContain("hostile getter: deltaId");
  });

  it("a throwing contextId getter — the exact field the project's central refusal dedups on — returns the same typed failure, not a corrupted count", () => {
    const episodes = [episode(DELTA, CONTEXTS.a, "helped"), throwingGetterEpisode("contextId")];
    const result = tally(DELTA, episodes);
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: "hostile-episodes-input", message: expect.stringContaining("hostile getter: contextId") }) });
  });

  it("a throwing outcome getter returns the same typed failure", () => {
    const episodes = [episode(DELTA, CONTEXTS.a, "helped"), throwingGetterEpisode("outcome")];
    const result = tally(DELTA, episodes);
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ kind: "hostile-episodes-input", message: expect.stringContaining("hostile getter: outcome") }) });
  });
});

describe("tally — a mutating accessor (a getter that returns a different value on each read) is still read exactly once per field, never re-read to compute the count", () => {
  it("a contextId getter that alternates between two values on successive reads cannot be used to make one episode silently count toward two different Set entries", () => {
    let reads = 0;
    const mutating: Episode = {
      deltaId: DELTA,
      get contextId() {
        reads += 1;
        // If tally() ever re-read this field after its first, authoritative
        // read (e.g. once while building a Set key and again while
        // building a return value), this would let a single episode
        // contaminate the tally with two different contextId values.
        return (reads === 1 ? CONTEXTS.a : CONTEXTS.b) as never;
      },
      outcome: "helped",
      observedAt: "2026-09-23T00:00:00.000Z" as never,
    };
    const result = tally(DELTA, [mutating]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.tally.distinctContexts).toBe(1);
    expect(reads).toBe(1);
  });
});

describe("tally — a value that reaches Episode's type via an unsafe cast, carrying a runtime shape lib/contracts's own compile-time types would refuse, still fails closed", () => {
  it("a non-string contextId (e.g. a number, arriving via `as unknown as Episode` or JSON.parse of a malformed payload) is refused as invalid-episode-shape, not silently added to a Set as if it were a valid context", () => {
    const hostile = { deltaId: DELTA, contextId: 12345, outcome: "helped", observedAt: "2026-09-23T00:00:00.000Z" } as unknown as Episode;
    const result = tally(DELTA, [hostile]);
    expect(result).toEqual({ ok: false, error: { kind: "invalid-episode-shape", fields: ["contextId"] } });
  });

  it("a non-string deltaId and a non-string outcome on the same episode are BOTH named, not just the first one found", () => {
    const hostile = { deltaId: 7, contextId: CONTEXTS.a, outcome: null, observedAt: "2026-09-23T00:00:00.000Z" } as unknown as Episode;
    const result = tally(DELTA, [hostile]);
    expect(result).toEqual({ ok: false, error: { kind: "invalid-episode-shape", fields: ["deltaId", "outcome"] } });
  });

  it("an outcome that is a string but outside the closed helped|neutral|harmed set is refused as invalid-episode-outcome, never silently bucketed as harmed or dropped", () => {
    const hostile = { deltaId: DELTA, contextId: CONTEXTS.a, outcome: "catastrophic", observedAt: "2026-09-23T00:00:00.000Z" } as unknown as Episode;
    const result = tally(DELTA, [hostile]);
    expect(result).toEqual({ ok: false, error: { kind: "invalid-episode-outcome", values: ["catastrophic"] } });
  });

  it("a numeric score standing in for outcome (plan §2's own named attack — 'no numeric score standing in for it') is refused, not silently averaged or truthy-coerced", () => {
    const hostile = { deltaId: DELTA, contextId: CONTEXTS.a, outcome: 0.9, observedAt: "2026-09-23T00:00:00.000Z" } as unknown as Episode;
    const result = tally(DELTA, [hostile]);
    expect(result).toEqual({ ok: false, error: { kind: "invalid-episode-shape", fields: ["outcome"] } });
  });
});

describe("tally — shape/outcome/mismatch checks are themselves order-independent (a Set of offenders, not 'whichever came first')", () => {
  it("two different invalid outcome strings, in either order, produce the identical sorted error", () => {
    const a = { deltaId: DELTA, contextId: CONTEXTS.a, outcome: "zeta-bogus", observedAt: "2026-09-23T00:00:00.000Z" } as unknown as Episode;
    const b = { deltaId: DELTA, contextId: CONTEXTS.b, outcome: "alpha-bogus", observedAt: "2026-09-23T00:00:00.000Z" } as unknown as Episode;
    expect(tally(DELTA, [a, b])).toEqual(tally(DELTA, [b, a]));
    expect(tally(DELTA, [a, b])).toEqual({ ok: false, error: { kind: "invalid-episode-outcome", values: ["alpha-bogus", "zeta-bogus"] } });
  });
});
