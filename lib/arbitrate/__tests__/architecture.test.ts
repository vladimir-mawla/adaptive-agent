import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const arbitrateDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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

/** Same comment-stripping discipline `lib/contracts/__tests__/architecture.test.ts` and `lib/invariants/__tests__/architecture.test.ts` both already establish — the scans below target CODE, not this milestone's own extensive prose describing it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function findLineOffenses(files: string[], pattern: RegExp): { file: string; line: number; text: string }[] {
  const offenders: { file: string; line: number; text: string }[] = [];
  for (const file of files) {
    const code = stripComments(readFileSync(file, "utf-8"));
    code.split("\n").forEach((line, index) => {
      if (pattern.test(line)) {
        offenders.push({ file: path.relative(arbitrateDir, file), line: index + 1, text: line.trim() });
      }
    });
  }
  return offenders;
}

/**
 * PLAN §4 (M5) commits `arbitrate` to never consulting "a 'human override'
 * parameter for a `frozen` gate result, because no such parameter exists
 * in this function's signature at all." `.genesis/decisions/
 * 0001-contracts.md` records this as a BUILD REQUIREMENT for M5 to prove
 * with its OWN test once it exists — this is that test, the same
 * override-vocabulary scan `lib/contracts/__tests__/architecture.test.ts`
 * already runs over M1's own source, now run for real over
 * `lib/arbitrate`'s actual, shipped signature.
 */
describe("no override-shaped vocabulary exists in lib/arbitrate's own non-test CODE (comments excluded) — the M1-recorded build requirement, honoured", () => {
  it("contains no occurrence of the substring 'override', case-insensitive, in any non-test .ts file's code", () => {
    const files = listNonTestSourceFiles(arbitrateDir);
    expect(files.length).toBeGreaterThan(0);
    expect(findLineOffenses(files, /override/i)).toEqual([]);
  });

  it("FALSIFIABILITY: the scan does flag the word when it appears in real code, not just comments", () => {
    const fixture = [
      "// discussing override in a comment is fine, not flagged",
      "export interface Foo { readonly humanOverride: string; }",
    ].join("\n");
    const stripped = stripComments(fixture);
    expect(stripped).not.toMatch(/discussing override/);
    expect(/override/i.test(stripped)).toBe(true);
  });
});

/**
 * "CONSTRUCTION SITES MUST NOT NEED A CAST" — this milestone's own brief
 * names the exact failure mode M1 found (excess-property checking bypassed
 * by an intermediate `const`) and asks that `arbitrate`'s own construction
 * sites not reach for `as` to route around it. Proven here by SOURCE SCAN,
 * not merely by the absence of a compile error: a cast compiles clean by
 * design (that is what a cast is for), so the only way to confirm one was
 * never written is to look at the actual code.
 */
describe("lib/arbitrate's own non-test source contains no type cast at all", () => {
  it("no 'as <Type>' cast expression appears in any non-test .ts file's code", () => {
    const files = listNonTestSourceFiles(arbitrateDir);
    // Matches `as Identifier`/`as unknown`/etc. but not the English word
    // "as" appearing mid-sentence in an already-stripped comment (there are
    // none left at this point) or inside a string literal used only in
    // prose-like test fixtures (this scan targets non-test source only).
    expect(findLineOffenses(files, /\bas\s+[A-Za-z_][\w.<>[\]]*/)).toEqual([]);
  });

  it("FALSIFIABILITY: the scan does flag a real cast, not just the word 'as' in comments", () => {
    const fixture = ["// as a matter of style this function is small", "const x = y as SomeType;"].join("\n");
    const stripped = stripComments(fixture);
    expect(stripped).not.toMatch(/as a matter of style/);
    expect(/\bas\s+[A-Za-z_][\w.<>[\]]*/.test(stripped)).toBe(true);
  });
});

/**
 * BUILD REQUIREMENT FROM `.genesis/decisions/0001-contracts.md`: "`arbitrate`
 * must call `assertFrozenCitesNoEvidence` on any `frozen` decision it is
 * about to return or forward, and refuse to trust one that fails it."
 * Proven two ways in this milestone, not one: this scan confirms the call
 * actually appears in the shipped source (not merely imported and never
 * invoked); `__tests__/integrity.test.ts` separately proves the call is
 * load-bearing by gutting it.
 */
describe("arbitrate.ts actually calls assertFrozenCitesNoEvidence, not merely imports it", () => {
  it("the call appears in arbitrate.ts's own non-test code", () => {
    const files = listNonTestSourceFiles(arbitrateDir);
    const arbitrateFile = files.find((f) => f.endsWith("arbitrate.ts"));
    expect(arbitrateFile).toBeDefined();
    const code = stripComments(readFileSync(arbitrateFile as string, "utf-8"));
    expect(code).toMatch(/assertFrozenCitesNoEvidence\s*\(/);
  });
});

describe("lib/arbitrate's own non-test source does not mutate the InvariantRegistry it receives", () => {
  it("contains no array-mutating-method call and no index-assignment expression targeting the registry", () => {
    const MUTATING_METHODS = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"];
    const files = listNonTestSourceFiles(arbitrateDir);
    const methodPattern = new RegExp(`\\.(?:${MUTATING_METHODS.join("|")})\\s*\\(`);
    const indexAssignmentPattern = /\w+\s*\[[^\]]*\]\s*=(?!=)/;
    const offenses = [...findLineOffenses(files, methodPattern), ...findLineOffenses(files, indexAssignmentPattern)];
    expect(offenses).toEqual([]);
  });
});
