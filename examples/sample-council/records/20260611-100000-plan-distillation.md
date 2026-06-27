# Record — Plan: on-device distillation vs. from scratch

A decomposition session: the research-lead drafted a ROADMAP from the BRIEF and the
table red-teamed it before the chair wrote it.

- **Session:** 20260611-100000-plan-distillation
- **Mode:** plan
- **Concluded:** 2026-06-11 10:14
- **Chair:** research-lead
- **Seats:** research-lead, researcher, methodologist, critic
- **Task:** Decompose the distillation-vs-scratch brief into a research plan.

## Recommendation
A three-phase ROADMAP: lock the comparison (harness + equal-budget envelope) before
running either arm, run both arms under an identical augmentation regime, then
decide with a margin + CI + flip conditions. Phase 1 tasks are independent; the two
training arms are independent of each other but both depend on Phase 1.

## Reasoning trail
- The harness and budget must be frozen before training, or the arms aren't
  comparable — hence Phase 1 gates Phase 2.
- T2.3 exists only because the methodologist's augmentation confound (a BRIEF open
  question) would otherwise invalidate the head-to-head.
- T2.1 and T2.2 carry no dependency on each other, so they can run in parallel.

## Dissents (preserved)
- **methodologist:** Wanted augmentation folded into the T2.1/T2.2 acceptance
  criteria rather than a separate task, arguing a separate task invites skipping it.
  Chair kept it separate so the confound check is explicit and independently gateable.

## Follow-ups
- [ ] Execute T1.1 and T1.2 (owner: researcher)

→ memory updated: none
→ roadmap: `initiatives/distillation-vs-scratch/ROADMAP.md`
