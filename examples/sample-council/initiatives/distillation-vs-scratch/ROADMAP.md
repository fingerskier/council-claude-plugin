# Roadmap — On-device distillation vs. training from scratch

- **Initiative:** distillation-vs-scratch
- **Brief:** `BRIEF.md`
- **Updated:** 2026-06-11 10:00
- **Chair:** research-lead

## Phase 1 — Lock the comparison
### T1.1 — Freeze the eval harness and metric
- **Depends on:** none
- **Acceptance:** A reproducible script reports top-1 accuracy + CI on the 2026-Q1
  held-out set, run twice with identical numbers.
- [ ] open

### T1.2 — Fix the equal-budget envelope
- **Depends on:** none
- **Acceptance:** A written size + latency budget (≤30 MB, ≤15 ms p95 on the
  reference device) that both arms must meet, with the measurement procedure pinned.
- [ ] open

## Phase 2 — Run both arms
### T2.1 — Train the from-scratch baseline
- **Depends on:** T1.1, T1.2
- **Acceptance:** A from-scratch student inside the budget with a recorded held-out
  accuracy + CI.
- [ ] open

### T2.2 — Train the distilled student
- **Depends on:** T1.1, T1.2
- **Acceptance:** A distilled student (same architecture, frozen teacher) inside the
  budget with a recorded held-out accuracy + CI.
- [ ] open

### T2.3 — Hold augmentation constant across arms
- **Depends on:** T2.1, T2.2
- **Acceptance:** Evidence that both arms used identical augmentation, so the
  comparison is not confounded (resolves the BRIEF's augmentation open question).
- [ ] open

## Phase 3 — Decide
### T3.1 — Head-to-head verdict + flip conditions
- **Depends on:** T2.3
- **Acceptance:** A recommendation against the BRIEF success criteria, stating the
  margin, the CI, and the conditions under which the verdict reverses.
- [ ] open

## Revisions
- 2026-06-11 10:00 drafted → record: `records/20260611-100000-plan-distillation.md`
