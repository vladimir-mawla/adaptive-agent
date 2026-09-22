import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const contractsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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

/**
 * Strips `/* ... *\/` block comments and `// ...` line comments before the
 * scan below runs. THIS IS NOT THE SAME "correct behavior, not a bug"
 * situation `agent-control-tower`'s `human-id.ts` documents for its own
 * text-based scan matching its own prose: that scan's target was a CAST
 * SYNTAX (`` `as HumanId` ``) appearing anywhere, including inside a
 * comment discussing it, which is legitimate evidence of the risky
 * pattern being written down. This scan's target is different: whether
 * any CODE under `lib/contracts` (a field name, a parameter, a type,
 * an identifier) is named "override" — an English sentence in a doc
 * comment EXPLAINING that no such parameter exists (this file, and
 * adaptation-decision.ts's own header, both do exactly that, extensively)
 * is not itself the fact being checked for, and would make this scan
 * fail on its own documentation of the property it proves. Stripping
 * comments first is what makes the scan check the thing plan §4 (M5)
 * actually cares about — the SIGNATURE and the TYPES, not the prose
 * describing them.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function findOverrideOffenses(files: string[]): { file: string; line: number; text: string }[] {
  const offenders: { file: string; line: number; text: string }[] = [];
  for (const file of files) {
    const code = stripComments(readFileSync(file, "utf-8"));
    code.split("\n").forEach((line, index) => {
      if (/override/i.test(line)) {
        offenders.push({ file: path.relative(contractsDir, file), line: index + 1, text: line.trim() });
      }
    });
  }
  return offenders;
}

/**
 * PLAN §4 (M5, unbuilt) commits `arbitrate` to "never consult a 'human
 * override' parameter for a `frozen` gate result, because no such
 * parameter exists in this function's signature at all." M5 does not
 * exist yet for any test to inspect its actual signature — this test
 * proves the narrower, honest thing M1 actually owns: the CODE this
 * milestone ships (outside comments) gives a later milestone nothing
 * named "override" to wire up in the first place. It is a naming-level
 * scan of THIS milestone's own non-test source, not a guarantee about
 * `lib/arbitrate/arbitrate.ts`'s eventual signature (a build requirement
 * recorded for M5 itself to prove with its own test when it exists — see
 * `adaptation-decision.ts`'s header and `.genesis/decisions/
 * 0001-contracts.md`).
 */
describe("no override-shaped vocabulary exists in lib/contracts' own non-test CODE (comments excluded)", () => {
  it("contains no occurrence of the substring 'override', case-insensitive, in any non-test .ts file's code", () => {
    const files = listNonTestSourceFiles(contractsDir);
    expect(files.length).toBeGreaterThan(0);
    expect(findOverrideOffenses(files)).toEqual([]);
  });

  it("FALSIFIABILITY: the scan does flag the word when it appears in real code, not just comments", () => {
    // A synthetic fixture, not a real file under lib/contracts: proves the
    // scan mechanism itself would catch an actual offending identifier,
    // and that stripComments does not accidentally swallow real code.
    const fixture = [
      "// discussing override in a comment is fine, not flagged",
      "export interface Foo { readonly humanOverride: string; }",
    ].join("\n");
    const stripped = stripComments(fixture);
    expect(stripped).not.toMatch(/discussing override/);
    expect(stripped).toMatch(/humanOverride/i);
  });
});
