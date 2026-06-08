# Memory: Council record and memory format

Durable conventions for how `meeting`/`work` sessions persist their output. Keep
it short: decisions and their *why*, not transcripts.

## Decision

Council `meeting`/`work` sessions write a **record file** (named by session id,
`<YYYYMMDD-HHMMSS>-<slug>.md`, in `records/`) and **memory topic files** in
pinned formats. Records use H1 `# Record —`, six ordered bold fields
(Session / Mode / Concluded / Chair / Seats / Task), and sections
`Recommendation` / `Reasoning trail` / `Dissents (preserved)` / `Follow-ups`,
closing with `→ memory updated:`. Memory files use `# Memory:` with a required
`## Decision` (carrying a `→ record:` back-link) and `## Why`, hold durable
decisions only (no transcript), and are named by a deterministic kebab-case
durable-subject slug, reused-else-created. A two-gate conformance check enforces
*dissents-preserved* and *bidirectional cross-link closure*; the templates pin
the rest.

A later **review** (session `20260607-213032-review-phase-2`) confirmed the
formats are sound and dogfooded and recommended merge, but found the formats and
gates **incomplete, not over-trimmed**. The review's five gaps were then **closed
in SKILL.md** (see *Resolved gaps* below) — the merge and the fixes both landed on
`main`.

→ record: `records/20260607-210234-implement-phase-2.md` (set the format)
→ record: `records/20260607-213032-review-phase-2.md` (reviewed it; logged the gaps)

(Two back-links are intentional: this topic was set by one session and revised by
a later one. Carrying back-link *history* rather than overwriting is the
demonstrated resolution to "Hole A" below — the template should sanction it.)

## Why

These were the two genuinely underspecified parts of Phase 2 and the parts most
prone to drift across sessions; pinning them keeps records legible and memory
accretive rather than duplicated. The conformance check is intentionally minimal
— it guards only what templates can't self-enforce — reflecting a preserved
QA-vs-PM trade-off (drift-control vs. process-overhead) that this session
resolved toward minimalism.

## Resolved gaps (review → fixed in SKILL.md)

The review's five completeness gaps were closed as **template/spec completions
plus a tightening of the existing Gate 2 — no third gate** (PM's line held). All
now live in `skills/council-orchestrator/SKILL.md`:

- **Hole A — back-link cardinality → history list.** A topic's `## Decision` now
  carries **one or more** `→ record:` back-links; a revising session **appends**
  a new line (newest last), never overwrites. Resolves the latent data-loss where
  a second touch dangled the earlier record's closure. (This file demonstrates
  the list form.)
- **Archive, don't delete, the scratchpad.** Both verbs now **archive**
  `scratch/<id>.md` → `records/<id>.scratch.md` so Gate 1 stays re-checkable
  after the fact.
- **Gate 2 made mechanical.** `→ record:` is now constrained to a backticked
  `records/<id>.md` path or the bare literal `STANDING` (optional trailing
  parenthetical) — never free prose — so closure is a script, not a skim. The
  example `testing-standards.md` prose back-link was converted to `STANDING`.
- **Empty- and multi-topic `→ memory updated:` forms pinned.** One line per
  topic; `→ memory updated: none` for a session that wrote no durable memory.
- **F1 — owner rule reconciled with its example.** Follow-up owners are **full
  seat names**; the `adopt-job-queue` example was fixed (`qa` → `qa-engineer`,
  etc.).
- **F2 — history correction** added to the prior Phase-2 record's reasoning
  trail: the `meeting` verb predated that session; it delivered the format tail.

## Standing dissent (qa-engineer)

If records later ship malformed in ways the templates don't catch, revisit QA's
stricter stance: a fuller post-synthesis conformance checklist. It wasn't wrong
in the Phase-2 session — it was out-scoped in PM's favor. **Update from the
review:** the tension converged — PM conceded QA's three re-aimed asks (Gate-2
enum, empty/multi-topic forms, Hole A) on the merits. The residual is *shape*,
not *whether*: completeness fixes go in the templates; verification stays at two
gates. QA's axis (drift / un-auditability) and PM's axis (process overhead)
remain the live trade-off to balance on the next format change.
