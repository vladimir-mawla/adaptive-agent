import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * ============================================================
 * CASE 15 — `eslint.config.mjs` IGNORES ALL `.ts`/`.tsx` FILES, SO
 * `npm run lint` IS LARGELY VACUOUS OVER THIS REPO'S OWN SOURCE (named
 * explicitly in this milestone's own brief; recorded in
 * `.genesis/decisions/0006-domain.md`'s own "Observation recorded for M9")
 * ============================================================
 * KIND: DISCLOSES A DELIBERATE, DISCLOSED PROCESS GAP.
 *
 * THE GAP, STATED PLAINLY: `typescript-eslint` (and therefore
 * `eslint-config-next`, which bundles it) hard-throws at require time
 * against TypeScript 7.x — this project pins `typescript@7.0.2`
 * (`package.json`), so `eslint.config.mjs` is deliberately NOT
 * TypeScript-aware and explicitly ignores `**\/*.ts`/`**\/*.tsx` (its own
 * header names the exact upstream issue,
 * `typescript-eslint/typescript-eslint#10940`). The practical consequence:
 * `npm run lint` passing is a real check only over plain JS/config files
 * — it examines NONE of this repository's own TypeScript source under
 * `lib/**`/`domains/**`/`app/**`/`tests/**`. `npm run typecheck` (`tsc`,
 * not `eslint`) is the actual static-analysis backstop.
 *
 * REVISION NOTE (L4 VERIFY caught this milestone's own first draft
 * overclaiming): the first version of this file asserted "the same
 * fixture... is rejected by `npm run typecheck`" while placing the
 * scratch fixture under a DOT-PREFIXED directory
 * (`tests/failures/.scratch-case-15/`). That claim was never actually
 * checked against a real `tsc` run — and it is FALSE as originally
 * written: `tsc`'s own directory-crawling behavior for an `include` glob
 * (`tests/**\/*.ts` in `tsconfig.lib.json`) silently SKIPS any
 * dot-prefixed directory it encounters while walking the filesystem, the
 * same convention `.git`/`.next`/`node_modules`-style tooling almost
 * always applies to hidden directories. `npm run typecheck` exits 0 with
 * the broken fixture present under a dot-directory, having never seen
 * it — reproduced directly below (SECOND test), not merely asserted.
 * THIS IS ITSELF A SECOND, REAL GOTCHA worth a reader knowing, distinct
 * from the eslint gap this case exists to pin: a scratch/tooling
 * directory named with a leading dot is invisible to `tsc`'s own
 * `include` crawl, silently, with no warning — exactly the kind of
 * "passes for the wrong reason" trap this milestone's own house
 * discipline exists to catch, caught here by the verifier rather than
 * shipped uncorrected. The fix: the fixture now lives under a
 * NON-dot-prefixed scratch directory, and this file's own THIRD test
 * confirms `tsc` really does reject it there, run for real.
 *
 * WHY THIS IS NOT THIS MILESTONE'S TO FIX (the underlying eslint gap):
 * `eslint.config.mjs` is genesis-time infrastructure, copied verbatim
 * from a sibling project per `.genesis/PLAN.md` §5 — revisiting it is
 * explicitly deferred ("revisit once typescript-eslint supports TS 7...
 * or add it back per-file if a milestone specifically needs TS-aware
 * lint rules before then"), and no milestone so far has needed that.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED):
 * `eslint.config.mjs` gaining TypeScript-aware linting (once
 * `typescript-eslint` supports TS 7, or via a downgrade) that actually
 * inspects `.ts` source — at which point this file's own lint test (a
 * deliberately bad, `lint`-invisible `.ts` fixture) would need to start
 * failing `npm run lint`, not merely `npm run typecheck`.
 */
describe("CASE 15 (DISCLOSES): eslint.config.mjs excludes all TypeScript source, so npm run lint cannot see it", () => {
  const configSource = readFileSync(path.join(repoRoot, "eslint.config.mjs"), "utf-8");

  it("the config's own ignores list excludes **/*.ts and **/*.tsx", () => {
    expect(configSource).toMatch(/["']\*\*\/\*\.ts["']/);
    expect(configSource).toMatch(/["']\*\*\/\*\.tsx["']/);
  });

  it("SECOND GOTCHA, DISCLOSED FOR ITS OWN SAKE: a dot-prefixed scratch directory is invisible to tsc's own include-glob crawl — a broken .ts fixture placed there is missed by npm run typecheck too, not merely by eslint", () => {
    const dotScratchDir = path.join(repoRoot, "tests", "failures", ".scratch-case-15-dotdir-repro");
    const dotScratchFile = path.join(dotScratchDir, "deliberately-broken.ts");
    try {
      execSync(`mkdir -p ${JSON.stringify(dotScratchDir)}`, { cwd: repoRoot });
      writeFileSync(dotScratchFile, "export const x = whollyUndeclaredIdentifier;\n", "utf-8");
      const typecheckExitCode = runAndGetExitCode("npm run typecheck");
      // THE GOTCHA: tsc's own directory crawl for tsconfig.lib.json's
      // "tests/**/*.ts" include glob never descends into a dot-prefixed
      // directory at all, so this genuinely broken file is never even
      // read — typecheck reports success, having seen nothing.
      expect(typecheckExitCode).toBe(0);
    } finally {
      execSync(`rm -rf ${JSON.stringify(dotScratchDir)}`, { cwd: repoRoot });
    }
  });

  it("CONCRETE DEMONSTRATION OF THE REAL GAP, from a NON-dot scratch directory so tsc actually sees it: a deliberately broken .ts fixture (a real, unambiguous ESLint violation AND a real TS2304) passes npm run lint silently, but IS correctly rejected by npm run typecheck", () => {
    const scratchDir = path.join(repoRoot, "tests", "failures", "scratch-case-15");
    const scratchFile = path.join(scratchDir, "deliberately-broken.ts");
    try {
      execSync(`mkdir -p ${JSON.stringify(scratchDir)}`, { cwd: repoRoot });
      // `whollyUndeclaredIdentifier` is not declared anywhere — a plain,
      // unambiguous `no-undef`-class mistake ESLint's own recommended
      // config (this file's own `js.configs.recommended`) would ordinarily
      // flag, AND a real TypeScript compile error (TS2304). This fixture
      // is not dot-prefixed, so tsconfig.lib.json's own "tests/**/*.ts"
      // include glob DOES crawl into it (see the dot-directory test
      // above for the contrast) — written to disk, then removed, never
      // committed.
      writeFileSync(scratchFile, "export const x = whollyUndeclaredIdentifier;\n", "utf-8");

      const lintExitCode = runAndGetExitCode("npx eslint tests/failures/scratch-case-15/deliberately-broken.ts");
      // eslint's own ignores list means it never even looks at this file —
      // "no errors" here is NOT evidence the file is fine, it is evidence
      // the file was never examined at all (see the config-read test above).
      expect(lintExitCode).toBe(0);

      const { exitCode: typecheckExitCode, output: typecheckOutput } = runAndCaptureOutput("npm run typecheck");
      // THE CONTRAST THAT MAKES THIS CASE REAL: the identical fixture,
      // from a directory tsc's own crawl actually reaches, genuinely
      // fails typecheck — proving npm run typecheck really is the
      // backstop npm run lint is not, not merely asserted from reading
      // eslint.config.mjs's own prose.
      expect(typecheckExitCode).not.toBe(0);
      expect(typecheckOutput).toMatch(/TS2304/);
      expect(typecheckOutput).toMatch(/whollyUndeclaredIdentifier/);
    } finally {
      execSync(`rm -rf ${JSON.stringify(scratchDir)}`, { cwd: repoRoot });
    }
  });

  function runAndGetExitCode(command: string): number {
    try {
      execSync(command, { cwd: repoRoot, stdio: "pipe" });
      return 0;
    } catch (err) {
      const withStatus = err as { status?: number };
      return withStatus.status ?? 1;
    }
  }

  function runAndCaptureOutput(command: string): { exitCode: number; output: string } {
    try {
      const output = execSync(command, { cwd: repoRoot, stdio: "pipe" }).toString();
      return { exitCode: 0, output };
    } catch (err) {
      const withDetails = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
      const output = `${withDetails.stdout ?? ""}${withDetails.stderr ?? ""}`;
      return { exitCode: withDetails.status ?? 1, output };
    }
  }
});
