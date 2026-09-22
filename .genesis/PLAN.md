# Adaptive Agent — G0–G2 Plan

Project 6 of 8. Cluster: "who's watching?" (with `agent-control-tower`, built, and Autonomous
Company Simulator, not yet built). Today: 2026-09-22. This document is a plan, not code — no repo
exists yet, nothing here has been scaffolded.

Sources actually read before writing this, on `main` (every repo was already on `main` in its
working tree — `git rev-parse --abbrev-ref HEAD` checked first for all five, no stale-branch
surprise this time), via `git show origin/main:<path>`: for all five —
`README.md`, `docs/ARCHITECTURE.md`; and additionally `agent-control-tower`'s
`.genesis/PLAN.md` (first ~80 lines, for the house format this plan follows),
`next.config.ts`, `package.json`, `tsconfig.json`, `tsconfig.lib.json`, `vitest.config.ts`,
`eslint.config.mjs` (the exact files this plan says to copy). Nothing below is asserted from
memory of what these projects "probably" contain — every claim about a sibling traces to one of
those reads.

---

## 0. What the five built/planned siblings already claim (so Adaptive Agent doesn't repeat it)

| Project | Question it answers | Central closed enum | Shape of the decision |
|---|---|---|---|
| agent-trust-layer | May you act, counterparty? | (no single outcome enum — a 4-layer verification chain: identity → claims → verification → policy, fails closed) | Bilateral, per-request: does a presented, cryptographically verifiable credential authorize *this* action, *now*? |
| decision-engine | May *I* act, given my own evidence? | `Outcome` = execute · ask · defer · escalate · refuse (escalate has 4 sub-causes via `RuleTrace.kind`) | Single-agent, single proposed action, evaluated **before** it runs, gated on stakes (cost × reversibility) vs. evidence. |
| shadow-run | What would happen if I acted — and did reality match? | `Reconciliation` = confirmed · drifted · unprojected; `Rollback` outcome = restored · failed · dishonest · unavailable | Single-agent, single action: project it, execute it, diff prediction against reality, roll back if wrong. |
| memory-ledger | What do I believe, and might it be stale or wrong? | `BeliefAnswer` = believed · doubted · disputed · unknown; `ForgetReason` = age-exceeded · contradicted · superseded · scope-exited · source-revoked | Single reasoner's own fact store, decaying and contradicting itself over time; forgetting is tombstoning, never deletion. |
| agent-control-tower | What may a supervisor do to an *already-running* agent it did not start? | `Intervention` = observe · warn · pause · quarantine · halt (forced) | Refuses an intervention more forceful than the offending agent's own corroborated, checkpointed evidence supports; multiple agents' conflicting claims arbitrated at once. |

All five are about a fixed decision boundary: whether to act, what happened when acting, what to
believe, or what to do to *someone else's* running process. **None of them asks whether the agent
should change its own future behavior because of what it has seen** — and that gap, not "an agent
that learns from feedback" (the prompt-wrapper-adjacent reading the brief warns against), is
Adaptive Agent's actual spine. `agent-control-tower` is the nearest neighbour because it also
"watches" and also refuses to overreact to weak evidence — but it watches a *different, external*
agent's resource claims at a single moment of collision. Adaptive Agent watches **one agent's
proposed changes to itself**, accumulated **across time and repeated, independent occasions** —
temporal corroboration of a *self*-modification, not point-in-time arbitration of an *external*
conflict. That distinction is also what leaves room for Autonomous Company Simulator: this project
never models more than one agent's own history: whatever that project builds at the multi-agent,
organizational-oversight scale is untouched here.

---

## 1. The one-sentence claim, and the counterclaim

**Claim:** The question that matters for a self-adapting agent is not "did this feedback improve
behavior" — it is whether independent, diverse evidence, not one loud incident, has actually earned
a proposed change the right to stick, whether the agent is structurally forbidden from adapting the
constraints it was *given* rather than the behavior it *chose*, and whether it can prove — and
honestly reverse — the moment an adopted change turns out to have made things worse.

**Counterclaim a judge could reasonably raise:** "Gating every adaptation on multi-context
corroboration is too conservative — a single catastrophic failure (an agent that told a customer
something false, or auto-approved something it shouldn't have) should change behavior immediately,
not wait for a second occurrence while more customers eat the same mistake. This design trades real
responsiveness for a caution that a single well-designed severity-weighted update could capture
instead." The honest answer isn't rhetorical: it's that this plan's corroboration bar is deliberately
**asymmetric** — see §2 and §3 M5 — reverting a live behavior takes less independent evidence than
adopting a new one in the first place, precisely because the cost of a slow revert is higher than
the cost of a slow adoption. Whether that asymmetry is calibrated right is exactly the kind of thing
a judge is entitled to disagree with, and this plan says so rather than hiding the tradeoff.

---

## 2. The closed domain vocabulary

### Supporting types (load-bearing, not the enum at the centre)

- **`Invariant`** — `{ id: InvariantId, knob: KnobId, description }`. A frozen, closed-list
  constraint the agent was *given*, never one it can propose changing. The list of `InvariantId`
  values is declared once per domain at setup and is not extensible at runtime from anywhere in
  `lib/` or `domains/` — there is no function anywhere in this codebase that adds to or mutates an
  invariant registry after it is constructed. **Refuses** to let any amount of evidence, any
  `AdaptationDecision`, or any override parameter touch a knob an `Invariant` names — unlike
  `agent-control-tower`'s human-authorized forced halt, there is **no escape-hatch lane** here at
  all: changing an invariant requires a code change and a redeploy, not a runtime call, full stop.
- **`KnobId`** — a closed, per-domain enum naming exactly which behavior parameter a
  `BehaviorDelta` targets (e.g., in the M6 domain: `escalation-aggressiveness`,
  `response-directness`, `auto-refund-ceiling`). **Refuses** to let a `BehaviorDelta` name a knob as
  a free-text string — it is a literal union member, checked against the domain's own frozen list.
- **`BehaviorDelta`** — `{ id, knob: KnobId, from, to, proposedAt }`. A candidate change to one
  knob's value. **Refuses** to compile without both `from` and `to` (a delta that doesn't state what
  it's changing *from* cannot be checked for direction or magnitude later).
- **`Episode`** — `{ deltaId, contextId, outcome: "helped" | "neutral" | "harmed", observedAt }`. One
  independent occurrence bearing on a `BehaviorDelta` — either while it is a candidate (pre-adoption
  trial) or while it is live (post-adoption monitoring). `contextId` is the unit of independence:
  the ticket, session, or incident this episode came from. **Refuses** to let `outcome` be anything
  outside the closed three-value set — no numeric score standing in for it.
- **`EvidenceTally`** — `{ deltaId, distinctContexts, helped, neutral, harmed }`, computed by
  `lib/evidence` from an `Episode[]`. `distinctContexts` counts unique `contextId`s, **not** episode
  count — the single most important refusal in this project (see M3): a delta with 200 episodes, all
  from the same `contextId`, has `distinctContexts: 1`, because one loud incident is not two
  incidents no matter how many times it repeats.

### The closed enum at the centre: `AdaptationDecision`

```ts
type AdaptationDecision =
  | { kind: "adopt"; deltaId: BehaviorDeltaId; tally: EvidenceTally }
  | { kind: "hold"; deltaId: BehaviorDeltaId; tally: EvidenceTally; distinctContextsNeeded: number }
  | { kind: "revert"; deltaId: BehaviorDeltaId; tally: EvidenceTally; revertedTo: KnobValue }
  | { kind: "frozen"; deltaId: BehaviorDeltaId; invariant: InvariantId }
```

- **`adopt`** — the delta's pre-adoption `EvidenceTally` cleared the corroboration bar (distinct
  contexts *and* a helped-majority); the knob's live value becomes `to`. **Refuses** to fire without
  citing the exact tally that licensed it — never a bare `true`.
- **`hold`** — evidence exists but hasn't cleared the bar yet; `distinctContextsNeeded` states
  exactly how many more distinct contexts would flip this to `adopt`, so the decision is falsifiable
  and re-checkable, never a vague "not yet."
- **`revert`** — a *previously adopted* delta's post-adoption `EvidenceTally` crossed the (lower,
  disclosed-asymmetric) regression bar; the knob rolls back to its immediately-prior value
  (`revertedTo`), one step, not to the domain's original baseline if more than one delta has adopted
  since. **Refuses** to revert off a single post-adoption `harmed` episode — the same
  distinct-context discipline applies symmetrically to pulling a change back as to adopting it in
  the first place, just at a different, disclosed threshold.
- **`frozen`** — the delta's `knob` matches an `Invariant`; no `tally` field exists on this variant
  at the type level (a `frozen` decision citing evidence would misrepresent *why* it fired — it fires
  because of what the knob *is*, never because of what the evidence *says*). **Refuses** unconditionally,
  regardless of how much or how corroborated the evidence is.

---

## 3. Nine milestones

Each is independently verifiable and mergeable as its own PR. House shape followed: M1
contracts/types, M2 deploy skeleton (deployed now, not last), M3–M5 the three engine layers, M6 a
concrete domain, M7 the deliberate failure suite, M8 the demo UI, M9 deliverables.

### M1 — Contracts (`lib/contracts/**`)

**Scope:** `Invariant`, `KnobId`-shaped domain contract, `BehaviorDelta`, `Episode`,
`EvidenceTally`, `AdaptationDecision` (the four-variant closed enum above), plus an
`assertNeverAdaptationDecision` exhaustiveness guard.

**Files it owns:** `lib/contracts/invariant.ts`, `lib/contracts/behavior-delta.ts`,
`lib/contracts/episode.ts`, `lib/contracts/evidence-tally.ts`, `lib/contracts/adaptation-decision.ts`,
`lib/contracts/index.ts`, `lib/contracts/__tests__/*.test.ts`.

**What it refuses:** free-text `Episode.outcome`; a `BehaviorDelta` missing `from`/`to`; a `frozen`
`AdaptationDecision` literal carrying a `tally` field (type error, not a runtime check); an
exhaustiveness guard that silently stops matching a variant if a fifth is ever added without
updating every switch.

**Falsifiable check:** `npm test -- lib/contracts` plus TYPE-LEVEL test files (à la
`agent-control-tower`'s `intervention.test.ts`) asserting each shape above does not compile when
malformed; a live-proof test that deletes a case from a stand-in union during development and
confirms `tsc` fails at the predicted line, then restores it. An independent verifier can also try
hand-writing a `frozen` decision object with a `tally` field and confirm TypeScript rejects it.

### M2 — Deploy skeleton, deployed now (`app/api/health/**`, `next.config.ts`)

**Scope:** A live Vercel deployment from the very first merged PR after M1, per the house rule
("deployed at milestone 2, never last" — the previous hackathon project that skipped this never
deployed at all). `GET /api/health` runs a real self-check against `lib/contracts` (constructs a
sample `Episode`/`BehaviorDelta`, exercises `assertNeverAdaptationDecision` against all four live
variants) and reports the deployed commit SHA; returns 503, not 200, if the self-check fails.

**Files it owns:** `app/api/health/route.ts`, `next.config.ts`, `vercel.json` if needed.

**What it refuses:** to return 200 on a bare liveness ping with no real check behind it; to omit the
commit SHA (so a verifier can confirm what's live matches what's in the repo).

**Falsifiable check:** `curl -sf <live-url>/api/health` returns 200 with a real `checks.contracts`
block and a commit SHA matching `git rev-parse HEAD`; killing the self-check function (breaking a
contract on purpose, verified locally, then reverted) flips the response to 503, not a silent 200.

### M3 — Evidence (`lib/evidence/**`)

**Scope:** `tally(episodes: Episode[]): EvidenceTally` — pure, dedups by `contextId`, never by
episode identity.

**Files it owns:** `lib/evidence/tally.ts`, `lib/evidence/__tests__/*.test.ts`.

**What it refuses:** to let N episodes from one `contextId` count as N corroborating occasions —
`distinctContexts` is the size of a `Set<ContextId>`, not `episodes.length`; to crash on a hostile
`episodes` array (a throwing getter, a `Proxy`) — fails closed to a typed tally-failure value, never
an uncaught exception; to let episode order affect the result.

**Falsifiable check:** a property test — 1 real context plus a repetition storm (50, 500, 5000
identical-context episodes) always yields `distinctContexts: 1`; a permutation sweep over a
fixed multi-context scenario proves order-independence; a hostile-input test (`Proxy` that throws on
every property access) proves a typed failure, not a crash, is returned.

### M4 — The invariant gate (`lib/invariants/**`)

**Scope:** `gate(delta: BehaviorDelta, invariants: Invariant[]): "eligible" | "frozen"` — evaluated
purely on `delta.knob` against the domain's frozen invariant list, independent of any evidence.

**Files it owns:** `lib/invariants/gate.ts`, `lib/invariants/__tests__/*.test.ts`,
`lib/invariants/__tests__/architecture.test.ts`.

**What it refuses:** to let evidence quantity or quality change the gate's answer — a delta
targeting an invariant-protected knob is `"frozen"` whether it has zero episodes or ten thousand,
all `"helped"`; to let any function under `lib/invariants/**`'s own non-test source construct,
mutate, or spread a modified invariants array (a source-scan test, in the same spirit as
`agent-control-tower`'s literal-substring scan for `"forced"` under `lib/gate`) — invariants are
read, never written, from inside the running system.

**Falsifiable check:** a test feeding 10,000 synthetic `"helped"` episodes at an invariant-targeting
delta and confirming the gate output is still `"frozen"`; a grep-based architecture test confirming
no assignment expression under `lib/invariants/**` (excluding tests) writes to any array or object
whose declared type is `Invariant[]`.

### M5 — Arbitration (`lib/arbitrate/**`)

**Scope:** `arbitrate(delta, tally, gateResult, priorState): AdaptationDecision` — the ruling layer.
If `gateResult === "frozen"`, return `frozen` immediately, full stop. Otherwise: if the delta is not
yet adopted, compare `tally` against `MIN_DISTINCT_CONTEXTS_ADOPT` (disclosed, invented policy
constant, no researched basis — set to 3) and a helped-majority requirement, returning `adopt` or
`hold`; if the delta **is** already adopted (live), compare its post-adoption `tally` against
`MIN_DISTINCT_CONTEXTS_REVERT` (disclosed, invented, set to 2 — deliberately lower than the adopt
bar, the asymmetry named in §1) and a harmed-majority requirement, returning `revert` or (implicitly)
continued `adopt`.

**Files it owns:** `lib/arbitrate/arbitrate.ts`, `lib/arbitrate/policy-constants.ts`,
`lib/arbitrate/__tests__/*.test.ts`.

**What it refuses:** to select `adopt` for a not-yet-adopted delta below `MIN_DISTINCT_CONTEXTS_ADOPT`,
no matter how enthusiastic the evidence within one context is; to select `revert` off a single
post-adoption `harmed` episode — the revert bar is lower than the adopt bar, but it is not zero; to
let two `BehaviorDelta`s that target the identical `KnobId` both resolve `adopt` at once — arbitrate
enforces at most one live delta per knob, deterministically rejecting (via `hold`, with a stated
reason) a second delta on an already-adopted knob until the first is reverted or superseded; to ever
consult a "human override" parameter for a `frozen` gate result, because no such parameter exists in
this function's signature at all.

**Falsifiable check:** unit tests for the exact N-vs-N+1 boundary at both `MIN_DISTINCT_CONTEXTS_ADOPT`
and `_REVERT`; a test asserting `arbitrate` called on a `frozen`-gated delta with an
artificially-constructed 10,000-episode, all-helped tally still returns `frozen`; a test asserting a
second delta targeting an already-adopted knob returns `hold`, never a silent second `adopt`.

### M6 — Domain: support-triage agent (`domains/support-triage/**`)

**Scope:** A concrete agent that triages support tickets and proposes deltas to three knobs:
`escalation-aggressiveness` and `response-directness` (both adaptable), and `auto-refund-ceiling`
(declared as the domain's one seeded `Invariant` — the agent may never propose raising or lowering
the dollar ceiling above which a refund requires human approval, no matter how many tickets argue for
it). Tickets resolved without appeal produce `"helped"` episodes; tickets overturned on appeal
produce `"harmed"` episodes.

**Files it owns:** `domains/support-triage/knobs.ts`, `domains/support-triage/invariants.ts`,
`domains/support-triage/scenario.ts`, `domains/support-triage/__tests__/*.test.ts`,
`scripts/demo-triage.ts`.

**What it refuses:** to register `auto-refund-ceiling` as an adaptable knob anywhere in this
domain's own setup code (it is only ever named inside `invariants.ts`, never inside `knobs.ts`); to
let a proposed delta targeting the refund ceiling reach `arbitrate` with anything but a `frozen`
result.

**Falsifiable check:** `npm run demo:triage` — a scripted run showing an `escalation-aggressiveness`
delta accumulate `hold` → `hold` → `adopt` across three distinct tickets, then accumulate two
distinct `harmed` post-adoption episodes and flip to `revert`; and, in the same run, a delta proposal
against `auto-refund-ceiling` immediately ruled `frozen` regardless of how many synthetic
corroborating episodes are attached to it. Exits non-zero unless all four `AdaptationDecision` kinds
are actually observed in the run.

### M7 — Failure suite (`tests/failures/**`, ~10 cases)

See §4 below for the sketch. Scope: pin real limits, not happy paths, each traced to a design
decision already made above — not invented at M7 the way one prior sibling's own sketch named a
mechanism ("a future-dated heartbeat failing closed") that turned out not to exist in the shipped
code.

**What it refuses:** to claim a limit is closed when it isn't — each case either proves a refusal
holds under adversarial conditions, or honestly documents a disclosed gap with a passing test that
demonstrates the gap rather than papering over it.

**Falsifiable check:** `npm test -- failures` — every case in `tests/failures/**` passes, and each
file's own header states plainly whether it is proving a refusal or disclosing a limit.

### M8 — Demo UI (`app/`, `components/`)

**Scope:** The interactive page. Headline moment, visible well under 90 seconds: a panel per knob
showing its current `AdaptationDecision` state; a control to inject an `Episode` with a chosen
`contextId` and `outcome`; injecting three distinct-context `"helped"` episodes against
`escalation-aggressiveness` flips it live from `hold` to `adopt`; injecting two distinct-context
`"harmed"` episodes afterward flips it to `revert`; attempting the identical sequence against
`auto-refund-ceiling` shows `frozen` from the first injection, never moving regardless of how many
episodes are added.

**Files it owns:** `app/page.tsx`, `components/AdaptiveAgentDemo.tsx`,
`components/compute-demo-view.ts`, `components/__tests__/*.test.ts(x)`.

**What it refuses:** to let the invariant-protected knob's panel ever show `hold` or `adopt` — it is
`frozen` from the first render, with no code path that recomputes it from injected episodes at all.

**Falsifiable check:** a WALKTHROUGH.md script, beat-by-beat, verified against the deployed URL in
the same session it's written (matching the house precedent in all five siblings); a render-smoke
test over `AdaptiveAgentDemo.tsx` via `react-dom/server`'s `renderToStaticMarkup`, no jsdom.

### M9 — Deliverables

**Scope:** `README.md`, `docs/ARCHITECTURE.md` (stage-by-stage, each refusal cited to a real test,
following the shape `agent-control-tower`'s own document settled on and cites its reasoning for),
`docs/THESIS.md` (≤300 words), `docs/WALKTHROUGH.md`, `docs/NOTES.md`, a Loom script (90 seconds), and
an honest "Limits" section in the README naming every disclosed gap from M7 in one place.

**What it refuses:** to claim a milestone complete that a drift guard (`app/milestones.test.ts`,
same pattern as `decision-engine` and `agent-trust-layer`) cannot confirm against `.genesis/DONE.html`.

**Falsifiable check:** the clean-clone command (`git clone` into a fresh temp dir, `npm ci`,
`npm run typecheck`, `npm test`, `npm run build`) run for real in the session that writes this
milestone, output pasted verbatim, not narrated from memory.

---

## 4. The failure suite sketch (~10 cases)

Each case below is traced to a specific refusal named in §3, not invented fresh at M7. Per the
brief's own caution, one or more of these may turn out, once M1–M6 are actually built, to describe a
mechanism that doesn't exist yet in the shape sketched here — if so, the honest move (as every prior
sibling found) is to say so plainly in that case's file header, not to quietly redefine the case to
fit whatever shipped.

1. **Same-context replay storm** — one ticket's complaint, resubmitted or retried 500 times, must
   yield `distinctContexts: 1` and therefore never alone reach `adopt` (traces to M3's core refusal).
2. **Invariant-targeting delta with overwhelming evidence** — 10,000 synthetic `"helped"` episodes
   against a delta targeting `auto-refund-ceiling` still resolves `frozen` (traces to M4/M5).
3. **Revert off a single post-adoption incident** — one `"harmed"` episode after adoption must
   yield continued `adopt`, not `revert` — the revert bar is lower than the adopt bar but not zero
   (traces to M5's asymmetric-bar refusal).
4. **Two deltas racing the same knob** — a second delta proposed against an already-adopted knob
   before the first is reverted must resolve `hold`, never a silent second `adopt` overwriting the
   first (traces to M5).
5. **Hostile episode array** — a `Proxy` that throws on every property access, or a getter that
   throws on `.outcome`, fed to `tally()` must produce a typed tally-failure, not an uncaught
   exception (traces to M3).
6. **Source-diversity is not checked, only context-id is — disclosed, not fixed.** One customer
   opening five different tickets (five distinct `contextId`s) about the same underlying complaint
   satisfies `MIN_DISTINCT_CONTEXTS_ADOPT` exactly as if five different customers had — this system
   has no notion of "reporter identity" distinct from "context," and this case exists to prove that
   gap is real, not to claim it's closed.
7. **No time decay on episodes.** An episode from a year ago counts toward a delta's tally exactly
   as much as one from five minutes ago — `EvidenceTally` carries no time-weighting and
   `lib/evidence/tally.ts` never reads `observedAt` for anything but display. This is a deliberate,
   disclosed non-goal (borrowing `memory-ledger`'s decay machinery would blur this project's own
   spine into its sibling's), pinned here rather than silently left untested.
8. **Cumulative drift across many small adopted deltas is not checked.** Several individually
   adopted, individually within-bounds deltas to the *same* knob over time (each superseding the
   last) can walk the knob's live value arbitrarily far from its original baseline — nothing in
   `lib/arbitrate` inspects the *sequence* of adopted deltas for a knob, only the current one's own
   tally against the current gate. **This is the riskiest disclosed gap in this plan** (see report),
   named here deliberately rather than assumed solved, because building real cumulative-bound
   tracking is a materially bigger engine than a hackathon M3–M5 budget supports, and claiming it
   without building it is exactly the kind of unsupported claim this house's honesty standard exists
   to catch.
9. **Revert's rollback target when more than one delta has adopted since baseline.** `revertedTo`
   must be the *immediately prior* live value, not the domain's original baseline — a case
   constructing two sequential adoptions on one knob and reverting the second must land back on the
   first adopted value, not skip past it to the original.
10. **Malformed `BehaviorDelta` reaching `arbitrate` directly, bypassing normal proposal flow** — a
    hand-constructed delta whose `knob` string matches an `InvariantId`'s own `knob` field by
    coincidence (not because the domain proposed it against that invariant) must still resolve
    `frozen` — the gate matches on the knob value itself, structurally, never on how the delta was
    constructed or who proposed it.

---

## 5. The stack

Next.js 16 (App Router) + React 19, TypeScript, deployed to Vercel, Vitest for tests, `lib/` kept
framework-free (`environment: "node"`, no jsdom). Copied directly from
`~/Desktop/agent-control-tower` (confirmed identical need by reading all four files there):

- **`next.config.ts`** — `experimental.extensionAlias: { ".js": [".ts", ".tsx", ".js"] }`, and the
  build scripts pin webpack explicitly (`next dev --webpack`, `next build --webpack`), because
  Turbopack (Next 16's default) cannot resolve the NodeNext-style `.js`-suffixed relative imports
  `lib/` will use once frozen milestone by milestone.
- **`tsconfig.json`** and **`tsconfig.lib.json`** — the same split as `agent-control-tower`'s: the
  app config excludes `lib/**`, the lib config is `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `moduleResolution: "Bundler"`, targeting `ES2022`.
- **`vitest.config.ts`** — `environment: "node"`, `fileParallelism: false` (needed once any test
  under `lib/contracts/__tests__` walks the full tree or writes scratch files the way
  `agent-control-tower`'s `human-id.test.ts` does — copied as a precaution even before M1 needs it,
  same "pre-added-ahead-of-need" precedent that project's own file documents), include globs added
  per milestone as each layer's test directory comes into existence.
- **`package.json` scripts** — `dev`/`build` pinned to `--webpack`, `typecheck` running
  `tsc -p tsconfig.lib.json --noEmit && tsc -p tsconfig.json --noEmit`, `test` running `vitest run`,
  plus this project's own `demo:triage` in place of `demo:incident`.
- **`eslint.config.mjs`** — deliberately not TypeScript-aware: `typescript-eslint` (and therefore
  `eslint-config-next`, which bundles it) hard-throws on TypeScript 7.x at require time
  (`typescript-eslint does not support TS 7.0`, tracked upstream at
  `typescript-eslint/typescript-eslint#10940`); this project pins `typescript@7.0.2` like its
  siblings, so `lint` covers plain JS/config files only and `typecheck` (`tsc`, not eslint) is what
  actually checks `.ts`/`.tsx` sources.
- **`npm ci`, never `npm install`** — npm 11.5.1 on this account has a documented bug
  (`npm/cli#4828`) where `install` against an existing lockfile silently drops the platform-specific
  `@rolldown/binding-*` optional dependency Vitest resolves through, and `npm test` then fails with a
  bare "Cannot find native binding" that gives no hint the *install*, not the code, is at fault.

---

## 6. Infrastructure to copy vs. the core to invent

**Share:** the four config files above verbatim; the deploy-at-M2 discipline and the `/api/health`
shape (real self-check against `lib/contracts`, 503 on failure, commit SHA in the body); the
closed-module-graph / import-containment test pattern (`lib/contracts` → `lib/evidence` and
`lib/invariants` → `lib/arbitrate` → `domains/support-triage`, one direction, no cycle, checked by
grep the same way `agent-control-tower` checks its own); the `tests/failures/**` discipline (a file
header stating plainly whether a case proves a refusal or discloses a gap); the README/THESIS/
ARCHITECTURE/WALKTHROUGH/NOTES document shape and the "Honest limits" section convention; the
drift-guard pattern (`app/milestones.test.ts` failing the build if the deployed page's claims and
`.genesis/DONE.html` disagree).

**Never share:** `Invariant`/`BehaviorDelta`/`Episode`/`EvidenceTally`/`AdaptationDecision` and every
refusal listed in §2–§5 above — the entire question of whether *this* agent's *own* proposed change
to *itself* has earned corroboration across independent occasions, and the absolute,
no-override-lane freeze on invariant-protected knobs, is Adaptive Agent's alone. `agent-control-tower`'s
`Corroboration`/`ResourceClaim`/`Intervention` vocabulary, and its human-authorized escape hatch for
forced halts, is not reused here even in spirit — this project's frozen knobs have deliberately **no**
runtime escape hatch at all, which is the one place these two projects' otherwise-similar "refuse to
overreact to weak evidence" instincts actually diverge.

---

## Considered and rejected

- **"An agent that learns from feedback"** — the obvious, weak reading named directly in the brief.
  Rejected: it is a prompt-wrapper's cousin with no refusal at its centre, and risks the automatic
  disqualifier outright.
- **Multi-agent / fleet-wide adaptation propagation** (one agent's adopted delta automatically
  applied to a fleet of similar agents) — rejected. This pushes into exactly the multi-agent,
  organizational-oversight territory Autonomous Company Simulator is reserved for, and would
  duplicate `agent-control-tower`'s multi-participant aggregation problem under a different name.
- **A single continuous "adaptation-worthiness" score** replacing the four-variant
  `AdaptationDecision` — rejected. `agent-trust-layer`'s own README argues directly against exactly
  this move ("trust is not a number... nobody can name the evidence or say what would change it") —
  building a scored version here would rebuild the anti-pattern a sibling already spent a milestone
  arguing against.
- **Time-decayed evidence**, borrowing `memory-ledger`'s decay machinery (`ForgetReason`, a freshness
  interpreter over a `DecayPolicy`) so that old episodes count for less — considered and rejected in
  favor of an evidence unit with no time dimension at all, kept deliberately distinct from that
  sibling's own spine. Named as a disclosed limit in failure case 7 rather than silently built as a
  second decay engine wearing a different name.
- **Reusing `Corroboration`'s exact 3-value shape (`self-reported | cross-checked |
  independently-verified`)** from `agent-control-tower` — rejected in favor of `EvidenceTally`'s
  distinct-context counting, a different axis (how many independent occasions, not how well-checked
  one occasion is) that doesn't just relabel the neighbour's own vocabulary.
- **A human-override lane for invariant-protected knobs**, mirroring `agent-control-tower`'s
  human-authorized forced halt — rejected on the merits, not by omission: the brief's own framing
  question ("what must an agent be forbidden to adapt") is best answered by a constraint with
  *zero* runtime escape valve, which is also the one place this project's design most sharply
  diverges from its nearest neighbour rather than echoing it under a new name.
