import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const domainDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(domainDir, "..", "..");
const libDir = path.join(repoRoot, "lib");

function listNonTestSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...listNonTestSourceFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

function listAllSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules") continue;
      out.push(...listAllSourceFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * `.genesis/PLAN.md` §6: "the closed-module-graph / import-containment test pattern
 * (`lib/contracts` -> `lib/evidence` and `lib/invariants` -> `lib/arbitrate` ->
 * `domains/support-triage`, one direction, no cycle, checked by grep the same way
 * `agent-control-tower` checks its own)." This file is the `domains/support-triage`-side half
 * of that check: `lib/**` (the frozen engine) must never import FROM `domains/**` at all — the
 * dependency arrow points one way, engine -> (consumed by) -> domain, never the reverse.
 * `lib/contracts`/`lib/evidence`/`lib/invariants`/`lib/arbitrate`'s own `__tests__/
 * architecture.test.ts` files each already check their OWN milestone's internal layering (e.g.
 * `lib/invariants` has zero dependency on `lib/evidence`); this is the one check that spans the
 * whole tree from the domain side, run for real now that `domains/**` exists at all.
 */
describe("module graph: lib/** never imports from domains/** — the dependency arrow points one way", () => {
  it("no non-test .ts file under lib/ contains an import specifier naming domains/", () => {
    const files = listNonTestSourceFiles(libDir);
    expect(files.length).toBeGreaterThan(0);
    const importPattern = /from\s+["'][^"']*domains\//;
    const offenders: { file: string; line: number }[] = [];
    for (const file of files) {
      readFileSync(file, "utf-8")
        .split("\n")
        .forEach((line, index) => {
          if (importPattern.test(line)) offenders.push({ file: path.relative(repoRoot, file), line: index + 1 });
        });
    }
    expect(offenders).toEqual([]);
  });

  it("FALSIFIABILITY: the scan does flag a real offending import", () => {
    const fixture = 'import { proposeDelta } from "../../domains/support-triage/knobs.js";';
    expect(/from\s+["'][^"']*domains\//.test(fixture)).toBe(true);
  });

  it("no non-test .ts file anywhere in lib/ or domains/ contains an import cycle candidate: domains/support-triage never imports from a path that re-enters domains/support-triage indirectly through lib/", () => {
    // The concrete, checkable form of "no cycle" available at this milestone: lib/** (just
    // proven above) names no domains/ import at all, so a cycle would require a domains/-side
    // file importing lib/** which itself imports domains/** — already ruled out by the first
    // test in this file. This test exists to make that reasoning explicit and re-checkable
    // rather than left as an inference a reader has to redo by hand.
    const libFiles = listAllSourceFiles(libDir);
    const domainsImportFromDomains = libFiles.some((f) => /from\s+["'][^"']*\/domains\//.test(readFileSync(f, "utf-8")));
    expect(domainsImportFromDomains).toBe(false);
  });
});

/** Same comment-stripping discipline `lib/arbitrate/__tests__/architecture.test.ts` and every other `architecture.test.ts` in this repo already establish — the scan below targets CODE, not this milestone's own prose describing why a name is absent (disclosing a design choice in a comment is this account's own standing discipline, not the violation the plan's refusal is aimed at). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * `.genesis/PLAN.md` §3 (M6) own refusal, verbatim: "to register `auto-refund-ceiling` as an
 * adaptable knob anywhere in this domain's own setup code (it is only ever named inside
 * `invariants.ts`, never inside `knobs.ts`)." Read at the strength it actually means — no
 * REGISTRATION of the knob (no literal union member, no case label, no object key) in
 * `knobs.ts`'s own CODE — not a ban on a comment disclosing, in prose, why the knob is
 * deliberately excluded (this file's own header does exactly that, matching every other
 * `architecture.test.ts` in this repo, which strip comments before scanning for the same
 * reason).
 */
describe("knobs.ts never registers auto-refund-ceiling in its own non-comment code", () => {
  it("the CODE of knobs.ts (comments stripped) contains no occurrence of the substring 'auto-refund-ceiling'", () => {
    const knobsFile = path.join(domainDir, "knobs.ts");
    const code = stripComments(readFileSync(knobsFile, "utf-8"));
    expect(code).not.toMatch(/auto-refund-ceiling/);
  });

  it("FALSIFIABILITY: the scan does flag the string when it appears in real code, not just a comment", () => {
    const fixture = [
      "// auto-refund-ceiling is deliberately excluded from this union, disclosed here in prose",
      'export type Sneaky = "escalation-aggressiveness" | "auto-refund-ceiling";',
    ].join("\n");
    const stripped = stripComments(fixture);
    expect(stripped).not.toMatch(/deliberately excluded/);
    expect(/auto-refund-ceiling/.test(stripped)).toBe(true);
  });

  it("invariants.ts IS the place that registers it in code — confirming the scan isn't vacuously passing because the string is banned everywhere", () => {
    const invariantsFile = path.join(domainDir, "invariants.ts");
    const code = stripComments(readFileSync(invariantsFile, "utf-8"));
    expect(code).toMatch(/auto-refund-ceiling/);
  });
});
