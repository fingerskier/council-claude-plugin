# Brief — On-device distillation vs. training from scratch

A framed research question for whether to distill our on-device intent classifier
from a larger teacher model or train a small model from scratch.

- **Initiative:** distillation-vs-scratch
- **Opened:** 2026-06-10 09:45
- **Status:** planned
- **Chair:** research-lead

## Question
For our on-device intent classifier (≤30 MB, ≤15 ms p95 on a mid-tier phone CPU),
does knowledge distillation from our 7B teacher beat training the same small
architecture from scratch on the same labeled data — measured by top-1 intent
accuracy at equal inference budget?

## Scope
- The 14-class intent set already in production.
- Small students at ≤30 MB after quantization.
- Offline eval on the held-out 2026-Q1 test set, plus latency on the reference device.

## Out of scope
- Changing the intent taxonomy or collecting new labels.
- Server-side inference (this is an on-device question).
- Teacher model selection — the 7B teacher is fixed (see Conventions).

## Assumptions
- The 7B teacher's labels are higher quality than the crowd labels on ambiguous cases.
- The reference device (Snapdragon-class mid-tier) represents the p95 user.

## Conventions (locked)
- "Beats" = a ≥1.0-point top-1 accuracy gain that holds on the held-out test set,
  not training/val.
- "Equal inference budget" = same quantized model size bucket (≤30 MB) and same
  p95 latency target (≤15 ms); a method that wins only by spending more budget does
  not count.
- Teacher = the frozen 7B `teacher-2026-03`; no teacher fine-tuning inside this study.
- Accuracy is measured on the 2026-Q1 held-out set only; the Q4 set is excluded
  (a mid-quarter label-policy change makes it a confounded benchmark).

## Success criteria
- [ ] A head-to-head accuracy number for distilled vs. from-scratch at equal budget,
      on the held-out set, with a confidence interval.
- [ ] A latency measurement on the reference device for the shipped candidate.
- [ ] A clear recommendation with the conditions under which it flips.

## Open questions
- Should soft-label temperature be tuned per-class, and does that change the verdict?
- Is data augmentation a confound we must hold fixed across both arms?

## Revisions
- 2026-06-10 09:45 framed → record: `records/20260610-094500-frame-distillation.md`
