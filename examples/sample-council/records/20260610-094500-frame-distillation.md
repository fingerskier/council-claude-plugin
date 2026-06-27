# Record — Framing: on-device distillation vs. from scratch

A framing session: the table surfaced what had to be pinned before the
distillation-vs-scratch question was researchable, and the chair wrote the BRIEF.

- **Session:** 20260610-094500-frame-distillation
- **Mode:** frame
- **Concluded:** 2026-06-10 09:58
- **Chair:** research-lead
- **Seats:** research-lead, researcher, methodologist, critic, journalist
- **Task:** Should we distill the on-device intent classifier or train it from scratch?

## Recommendation
Frame the question as a head-to-head at **equal inference budget** on a **frozen
held-out set**, with "beats" defined as a ≥1.0-point top-1 gain that holds out of
sample. Lock the teacher, the budget envelope, and the test set up front; the
written BRIEF is the framed problem.

## Reasoning trail
- The original ask ("should we distill?") was unanswerable as posed — no metric, no
  budget, no fixed teacher — so any result could be argued either way.
- The methodologist's equal-budget framing is what makes the two arms comparable; a
  distilled model that wins only by being larger answers a different question.
- Excluding the Q4 test set: a mid-quarter label-policy change makes it a confounded
  benchmark — the journalist traced the label drift to the policy change.

## Dissents (preserved)
- **critic:** A single accuracy number risks overfitting the decision to one test
  set; wants the verdict reported with a confidence interval, not a point estimate.
  (Folded into the success criteria.)
- **methodologist:** Augmentation is a likely confound and must be held fixed across
  arms, or the comparison is uninterpretable. Left as a BRIEF open question for the
  plan to resolve, not pre-decided here.

## Follow-ups
- [ ] Decompose the framed question into a ROADMAP (owner: research-lead)

→ memory updated: none
→ brief: `initiatives/distillation-vs-scratch/BRIEF.md`
