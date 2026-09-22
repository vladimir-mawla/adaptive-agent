import { defineConfig } from "vitest/config";

// Kept deliberately minimal: no framework plugin (no Next.js, no React)
// because lib/ must stay framework-free through M2's Next.js adoption —
// same discipline as this project's infrastructure siblings, decision-engine,
// shadow-run, memory-ledger, and agent-control-tower.
//
// Every include glob below except "tests/**/*.test.ts" is empty until M1 —
// the same "pre-added-ahead-of-need" precedent the sibling projects' own
// vitest.config.ts document: an empty glob costs nothing today and means
// this file never needs a second edit purely to teach vitest where a
// later, already-planned milestone's tests live.
//   - "lib/**/*.test.ts"      — M1 (contracts) onward
//   - "app/**/*.test.ts"      — M2 (deploy) / M8 (UI)
//   - "domains/**/*.test.ts"  — M6 (support-triage domain)
//   - "tests/**/*.test.ts"    — this repo's own smoke test now; M7's failure
//                                suite later (plan's freeze boundary is
//                                tests/failures/**)
//
// `fileParallelism: false` is deliberately NOT set here, unlike
// agent-control-tower's own vitest.config.ts at its current tip. That
// setting exists there only because specific tests under
// lib/contracts/__tests__/ walk the entire lib/ tree and write/remove
// real on-disk scratch files, which collide when vitest runs test files
// in parallel worker processes — agent-control-tower's own genesis-time
// vitest.config.ts (before any such test existed) didn't have it either.
// No test in this repo does that yet; if a future milestone adds one, add
// this option back at that point, not before.
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
      "domains/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    watch: false,
  },
});
