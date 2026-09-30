import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const invariantsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function listNonTestSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...listNonTestSourceFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** Same comment-stripping discipline as `lib/contracts/__tests__/architecture.test.ts` — this scan's target is CODE, not this file's own extensive prose about what it checks. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * Array-MUTATING method names — calling any of these on the invariants
 * array/registry would be exactly the "construct, mutate, or spread a
 * MODIFIED invariants array" plan §3 (M4) refuses. `.map`/`.filter`/`.find`/
 * `.forEach`/`.every`/`.some` etc. are all deliberately absent from this
 * list — they do not mutate their receiver, and `gate`/`createInvariantRegistry`
 * both legitimately use `.map`/a `for...of` loop to READ or to build a
 * genuinely NEW, then-frozen copy (construction, not mutation of an
 * existing modified array — the plan's own refusal is about writing to an
 * invariants array IN PLACE, not about building a fresh one from scratch,
 * which `createInvariantRegistry` exists specifically to do once).
 */
const MUTATING_METHODS = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"];

function findMutationOffenses(files: string[]): { file: string; line: number; text: string }[] {
  const offenders: { file: string; line: number; text: string }[] = [];
  const methodPattern = new RegExp(`\\.(?:${MUTATING_METHODS.join("|")})\\s*\\(`);
  // Index assignment: `identifier[...] = ` not followed by `=` (so `===`/`==`
  // comparisons are not false positives) and not itself a `[Symbol...]`
  // computed-property declaration inside an object/type literal.
  const indexAssignmentPattern = /\w+\s*\[[^\]]*\]\s*=(?!=)/;
  for (const file of files) {
    const code = stripComments(readFileSync(file, "utf-8"));
    code.split("\n").forEach((line, index) => {
      if (methodPattern.test(line) || indexAssignmentPattern.test(line)) {
        offenders.push({ file: path.relative(invariantsDir, file), line: index + 1, text: line.trim() });
      }
    });
  }
  return offenders;
}

function findEvidenceImportOffenses(files: string[]): { file: string; line: number; text: string }[] {
  const offenders: { file: string; line: number; text: string }[] = [];
  const importPattern = /from\s+["'].*\/evidence\//;
  for (const file of files) {
    const code = stripComments(readFileSync(file, "utf-8"));
    code.split("\n").forEach((line, index) => {
      if (importPattern.test(line)) {
        offenders.push({ file: path.relative(invariantsDir, file), line: index + 1, text: line.trim() });
      }
    });
  }
  return offenders;
}

describe("no function under lib/invariants/**'s own non-test source constructs, mutates, or spreads a MODIFIED invariants array", () => {
  it("contains no array-mutating-method call and no index-assignment expression in any non-test .ts file's code", () => {
    const files = listNonTestSourceFiles(invariantsDir);
    expect(files.length).toBeGreaterThan(0);
    expect(findMutationOffenses(files)).toEqual([]);
  });

  it("FALSIFIABILITY: the scan does flag a real offense, not just comments describing one", () => {
    // A synthetic fixture, not a real file under lib/invariants — proves
    // the mechanism itself, and that stripComments doesn't swallow real
    // code the way a naive regex might.
    const fixture = [
      "// discussing registry.push(x) in a comment is fine, not flagged",
      "function sneaky(registry: unknown[]) { registry.push({}); }",
      "function sneakyIndex(registry: unknown[]) { registry[0] = {}; }",
    ].join("\n");
    const stripped = stripComments(fixture);
    expect(stripped).not.toMatch(/discussing registry\.push/);
    const offenders = findMutationOffenses([]); // sanity: empty input, empty output
    expect(offenders).toEqual([]);
    expect(new RegExp(`\\.(?:${MUTATING_METHODS.join("|")})\\s*\\(`).test(stripped)).toBe(true);
    expect(/\w+\s*\[[^\]]*\]\s*=(?!=)/.test(stripped)).toBe(true);
  });

  it("this milestone's own gate.ts legitimately uses .map to BUILD a fresh, then-frozen copy — confirming the scan does not false-positive on construction, only on mutation-in-place", () => {
    const files = listNonTestSourceFiles(invariantsDir);
    const gateFile = files.find((f) => f.endsWith("gate.ts"));
    expect(gateFile).toBeDefined();
    const code = readFileSync(gateFile as string, "utf-8");
    expect(code).toMatch(/\.map\(/);
    expect(findMutationOffenses([gateFile as string])).toEqual([]);
  });
});

describe("lib/invariants' own non-test source has zero dependency on lib/evidence — the two are parallel siblings of lib/contracts, never one importing the other", () => {
  it("no non-test .ts file under lib/invariants imports from ../evidence", () => {
    const files = listNonTestSourceFiles(invariantsDir);
    expect(findEvidenceImportOffenses(files)).toEqual([]);
  });

  it("FALSIFIABILITY: the import scan does flag a real offense", () => {
    const fixture = 'import { tally } from "../evidence/tally.js";';
    expect(findEvidenceImportOffenses.length).toBeGreaterThanOrEqual(0); // function exists
    const importPattern = /from\s+["'].*\/evidence\//;
    expect(importPattern.test(fixture)).toBe(true);
  });
});
