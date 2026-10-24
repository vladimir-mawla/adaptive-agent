# Thesis

**The claim.** Whether an agent's proposed change to its own behaviour should stick depends on how many independent occasions support it, not on how often anyone has complained. This project counts corroboration by distinct `contextId`s, not by episodes. It asks fewer of them to undo a change (two) than to adopt one (three). And it gives one knob a freeze that no evidence can lift.

**Where a reader should disagree.**

1. A single severe incident should sometimes change behaviour at once. This design makes everyone wait for a third occasion.
2. Three and two are invented. Nothing here derives them, and nothing has run on real tickets: every episode in this repository is synthetic.
3. A freeze with no runtime override means moving a protected knob takes a code change and a redeploy. An operator may call that a defect.

**What would have to be true for it to fail.**

- Context ids are not canonical. One real ticket typed three ways clears the three-context bar; the live demo shows it, and nothing normalizes ids.
- A single severity-weighted score protects users as well. Then distinct-context counting is needless machinery.
- Wrongly adopted changes cost less than slowly adopted ones. Then the asymmetry points the wrong way.
- Correlated reporters are common, such as one customer with many tickets. Then distinct contexts overstate independence; the suite pins that gap too.

**What it does not show.** No agent consumes these decisions; the only callers are a demo script, a demo page and tests. Nor does anything check a knob's value, so a documented range is only a comment.
