/**
 * The two disclosed, invented policy constants plan §3 (M5) names by
 * value, with no researched basis claimed for either number — the same
 * "state the number plainly, don't dress it up as derived from something"
 * discipline this account's own sibling projects apply to their own
 * thresholds.
 *
 * `MIN_DISTINCT_CONTEXTS_ADOPT > MIN_DISTINCT_CONTEXTS_REVERT` IS THE
 * ASYMMETRY ITSELF, NOT A COINCIDENCE OF TWO SEPARATELY CHOSEN NUMBERS:
 * plan §1 states the asymmetry is deliberate — "reverting a change that is
 * hurting should be easier than adopting one in the first place" — because
 * the cost of a slow revert (continuing to ship a change that is actively
 * harming) is judged higher than the cost of a slow adopt (waiting one
 * more distinct context before a change takes effect). `arbitrate.ts`'s
 * own tests prove this is not merely true by construction of these two
 * numbers but actually changes the OUTPUT at the same tally shape (see
 * `__tests__/asymmetry.test.ts`): a tally with `distinctContexts: 2` is
 * read differently depending on whether the delta in question is a
 * not-yet-adopted candidate (bar not cleared — `hold`) or an already-live
 * delta under post-adoption monitoring (bar cleared — `revert`).
 */
export const MIN_DISTINCT_CONTEXTS_ADOPT = 3;
export const MIN_DISTINCT_CONTEXTS_REVERT = 2;
