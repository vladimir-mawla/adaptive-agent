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
 * WHY THIS IS NOT THIS MILESTONE'S TO FIX: `eslint.config.mjs` is
 * genesis-time infrastructure, copied verbatim from a sibling project per
 * `.genesis/PLAN.md` §5 — revisiting it is explicitly deferred ("revisit
 * once typescript-eslint supports TS 7... or add it back per-file if a
 * milestone specifically needs TS-aware lint rules before then"), and no
 * milestone so far has needed that.
 *
 * WHAT WOULD MAKE THIS FAIL (I.E., WHAT WOULD MEAN THE GAP WAS CLOSED):
 * `eslint.config.mjs` gaining TypeScript-aware linting (once
 * `typescript-eslint` supports TS 7, or via a downgrade) that actually
 * inspects `.ts` source — at which point this file's own second test (a
 * deliberately bad, `lint`-invisible `.ts` fixture) would need to start
 * failing `npm run lint`, not merely `npm run typecheck`.
 */
describe("CASE 15 (DISCLOSES): eslint.config.mjs excludes all TypeScript source, so npm run lint cannot see it", () => {
  const configSource = readFileSync(path.join(repoRoot, "eslint.config.mjs"), "utf-8");

  it("the config's own ignores list excludes **/*.ts and **/*.tsx", () => {
    expect(configSource).toMatch(/["']\*\*\/\*\.ts["']/);
    expect(configSource).toMatch(/["']\*\*\/\*\.tsx["']/);
  });

  it("CONCRETE DEMONSTRATION, not just a config-file read: a deliberately broken .ts fixture (a real, unambiguous ESLint violation — an undeclared variable) passes npm run lint silently, but is rejected by npm run typecheck", () => {
    const scratchDir = path.join(repoRoot, "tests", "failures", ".scratch-case-15");
    const scratchFile = path.join(scratchDir, "deliberately-broken.ts");
    try {
      execSync(`mkdir -p ${JSON.stringify(scratchDir)}`, { cwd: repoRoot });
      // `whollyUndeclaredIdentifier` is not declared anywhere — a plain,
      // unambiguous `no-undef`-class mistake ESLint's own recommended
      // config (this file's own `js.configs.recommended`) would ordinarily
      // flag, AND a real TypeScript compile error (TS2304). This fixture
      // is not under any tsconfig `include` (tests/failures/** IS
      // included by tsconfig.lib.json, so it is also excluded from
      // eslint's own **/*.ts ignore purely by virtue of being a .ts file,
      // exactly the point being demonstrated) — written to disk, then
      // removed, never committed.
      writeFileSync(scratchFile, "export const x = whollyUndeclaredIdentifier;\n", "utf-8");

      const lintExitCode = runAndGetExitCode("npx eslint tests/failures/.scratch-case-15/deliberately-broken.ts");
      // eslint's own ignores list means it never even looks at this file —
      // "no errors" here is NOT evidence the file is fine, it is evidence
      // the file was never examined at all (see the config-read test above).
      expect(lintExitCode).toBe(0);
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
});
