import {
  invariantId,
  behaviorDeltaId,
  assertFrozenCitesNoEvidence,
  type FrozenDecision,
  type EvidenceTally,
} from "../../../lib/contracts/index";

/**
 * Force dynamic + Node.js runtime: without `dynamic = "force-dynamic"`,
 * Next.js may treat this route as statically renderable and serve a
 * prerendered response from build time forever after — at which point the
 * "live" contracts check below becomes theatre, run once at build and
 * never again, and the commit SHA below would freeze at whatever it was
 * during the build that produced the static output. `runtime = "nodejs"`
 * matches agent-control-tower's own app/api/health/route.ts (the M2
 * precedent this file is adapted from — read from `origin/main` there,
 * not a stale branch) and is kept as explicit, self-documenting proof of
 * intent even though it is already Next 16.3+'s unconditional default for
 * route handlers.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ContractsCheckResult {
  readonly pass: boolean;
  readonly elapsedMs: number;
  readonly detail: string;
}

/**
 * Real work, not a liveness ping — adapted from agent-control-tower's own
 * app/api/health/route.ts (that file exercises a real piece of ITS lib/ on
 * every request; this one does the same against what THIS project has
 * actually built). At M2, only lib/contracts/** (M1, frozen) exists —
 * lib/evidence (M3), lib/invariants (M4), and lib/arbitrate (M5) do not,
 * so this check cannot — and must not pretend to — exercise them. Plan §4
 * (M2, "what it refuses"): "to return 200 on a bare liveness ping with no
 * real check behind it."
 *
 * `lib/contracts` (M1) has exactly one function with genuine runtime
 * branching worth exercising here — `assertFrozenCitesNoEvidence`
 * (`adaptation-decision.ts`); everything else in that milestone is a
 * closed-union type or an opaque id-brand mint function with no runtime
 * decision to check (`assertNeverAdaptationDecision` never runs on a value
 * TypeScript itself considers reachable, so there is nothing live to call
 * it against here). This check exercises `assertFrozenCitesNoEvidence` in
 * BOTH directions — a well-formed input that must pass, and a corrupted
 * one that must be caught — the same "structural discrimination, not
 * merely no exception" discipline agent-control-tower's own health check
 * documents:
 *
 *   1. A genuine `frozen` decision, built the only way `lib/contracts`
 *      lets a caller build one — a fresh literal with no evidence-shaped
 *      field populated (the type itself declares `tally`,
 *      `distinctContextsNeeded`, and `revertedTo` as `?: never` on this
 *      variant, so a well-formed value cannot carry any of them) -> must
 *      report `ok: true`.
 *   2. A value that reaches the identical `FrozenDecision` *type* only via
 *      an unsafe `as unknown as FrozenDecision` cast — `.genesis/
 *      decisions/0001-contracts.md`'s own Decision 1 names this exact cast
 *      as the one residual route the type system cannot close, and records
 *      calling `assertFrozenCitesNoEvidence` at every `frozen`-decision
 *      consumer as a BUILD REQUIREMENT for exactly this reason — carrying
 *      a real, populated `tally` alongside `kind: "frozen"` -> must report
 *      `ok: false` with `error.kind === "unexpected-evidence-on-frozen"`
 *      and `error.field === "tally"`.
 *
 * WHAT WOULD MAKE THIS REPORT UNHEALTHY: either assertion above failing —
 * a real regression in `assertFrozenCitesNoEvidence`'s own logic — or the
 * block throwing at all (caught below, never allowed to escape past the
 * endpoint). For example, if `assertFrozenCitesNoEvidence` were edited to
 * check only `distinctContextsNeeded`/`revertedTo` and stopped inspecting
 * `tally`, assertion 2 would flip to `ok: true` (the contaminated value
 * would pass undetected) and this check would fail, correctly, without
 * anyone needing to notice the gap by reading the diff. This was proven
 * for real, not merely asserted — see the PR description / report for the
 * local reproduction: the `tally` branch of the field loop in
 * `assertFrozenCitesNoEvidence` was temporarily commented out, `curl`
 * against a local `next dev` server was re-run, and `/api/health` returned
 * `503` with `checks.contracts.pass: false` before the line was restored
 * and the endpoint returned `200` again.
 *
 * DELIBERATELY SCOPED TO lib/contracts ONLY, NOT WIDENED PAST IT: matching
 * agent-control-tower's own precedent of keeping this endpoint pinned to
 * what existed at M2 rather than becoming a second, drifting copy of the
 * test suite as later milestones land. M3–M5 are unbuilt as of this
 * milestone; this comment does not promise this endpoint will grow to
 * cover them — only that it stays honest about what it covers today.
 */
function runContractsCheck(): ContractsCheckResult {
  const start = performance.now();
  try {
    // Direction 1: a genuine, well-formed `frozen` decision — the type
    // itself refuses to let this literal carry any evidence-shaped field
    // (see adaptation-decision.ts: `tally`/`distinctContextsNeeded`/
    // `revertedTo` are all `?: never` on this variant), so this is the
    // ordinary, uncorrupted construction path every real caller uses.
    const genuineFrozen: FrozenDecision = {
      kind: "frozen",
      deltaId: behaviorDeltaId("health-check-delta"),
      invariant: invariantId("health-check-invariant"),
    };
    const genuineResult = assertFrozenCitesNoEvidence(genuineFrozen);
    const genuineAccepted = genuineResult.ok === true;

    // Direction 2: a value that reached the `FrozenDecision` *type* only
    // via an unsafe cast, carrying a real, populated `tally` the type
    // system's `?: never` fields exist to refuse on any literal — the
    // exact bypass class `.genesis/decisions/0001-contracts.md` names as
    // this function's reason to exist.
    const fabricatedTally: EvidenceTally = {
      deltaId: behaviorDeltaId("health-check-delta"),
      distinctContexts: 5,
      helped: 5,
      neutral: 0,
      harmed: 0,
    };
    const contaminatedFrozen = {
      kind: "frozen",
      deltaId: behaviorDeltaId("health-check-delta"),
      invariant: invariantId("health-check-invariant"),
      tally: fabricatedTally,
    } as unknown as FrozenDecision;
    const contaminatedResult = assertFrozenCitesNoEvidence(contaminatedFrozen);
    const contaminatedCaught =
      contaminatedResult.ok === false &&
      contaminatedResult.error.kind === "unexpected-evidence-on-frozen" &&
      contaminatedResult.error.field === "tally";

    const pass = genuineAccepted && contaminatedCaught;
    return {
      pass,
      elapsedMs: performance.now() - start,
      detail: pass
        ? "assertFrozenCitesNoEvidence: well-formed frozen->accepted, cast-in evidence->rejected"
        : `contracts check failed: genuineAccepted=${genuineAccepted} contaminatedCaught=${contaminatedCaught}`,
    };
  } catch (err) {
    return {
      pass: false,
      elapsedMs: performance.now() - start,
      detail: `contracts check threw: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

export async function GET(): Promise<Response> {
  const contracts = runContractsCheck();

  const body = {
    status: contracts.pass ? "ok" : "degraded",
    // Set FOR us by Vercel on every deployment. Unset in local dev, where
    // the honest answer is "unknown," never a guessed or hardcoded SHA — a
    // health endpoint that fabricates its own provenance is worse than one
    // that admits it doesn't know (plan §4, M2: implicit in "reports the
    // deployed commit SHA" — fabricating one when unset would misrepresent
    // exactly what this endpoint exists to prove).
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown (local dev)",
    checks: {
      contracts: {
        pass: contracts.pass,
        elapsedMs: Math.round(contracts.elapsedMs * 1000) / 1000,
        detail: contracts.detail,
      },
    },
  };

  // Fail closed: a health endpoint that reports 200 while the one thing it
  // actually verified is broken is worse than no health endpoint at all.
  return Response.json(body, { status: contracts.pass ? 200 : 503 });
}
