# Example: a convened council

`sample-council/` is a reference snapshot of a `.council/` directory after a few
sessions. It is **documentation, not runtime** — nothing reads it. Its purpose is
to pin down the on-disk formats so the orchestrator and any contributor agree on
what these files look like.

The records reference code, tests, and decisions (`src/util/retry.ts`, a BullMQ
adoption, a faked-clock test, and so on) that are **illustrative fixtures** — they
exist in no repo. They're here only to show the *shape* of a real record, not to
describe work that was actually done.

```
sample-council/
├── council.yaml                              # the active council (from a template)
├── seats/                                    # one persona file per seat — body IS the system prompt
│   ├── staff-engineer.md                     #   (chair)
│   ├── security-engineer.md
│   ├── qa-engineer.md                        #   shows a per-project hand-edit
│   └── product-manager.md
├── memory/                                   # durable, one file per topic (decision #5)
│   ├── job-queue.md
│   └── testing-standards.md
├── scratch/                                  # ephemeral per-session working memory (gitignored)
│   └── 20260605-141200-rate-limiter.md       #   shown mid-meeting, Round 2 pending
├── records/                                  # durable synthesized outputs, kept + committed
│   ├── 20260603-093000-adopt-job-queue.md               #   Mode: meeting
│   ├── 20260606-101500-extract-retry-helper.md          #   Mode: work
│   ├── 20260606-101500-extract-retry-helper.scratch.md  #   that work session's archived scratchpad
│   ├── 20260610-094500-frame-distillation.md            #   Mode: frame (wrote the BRIEF)
│   └── 20260611-100000-plan-distillation.md             #   Mode: plan  (wrote the ROADMAP)
└── initiatives/                              # long-horizon initiatives (evolving, chair-written)
    └── distillation-vs-scratch/
        ├── BRIEF.md                          #   framed problem (from `meeting --frame`)
        └── ROADMAP.md                        #   decomposition  (from `work --plan`)
```

Format conventions illustrated here:

- **Seats** are **one markdown file per seat**, named to match the seat's entry
  in `council.yaml` (`qa-engineer` → `seats/qa-engineer.md`). The frontmatter is
  metadata (`name`, `title`, `voice`, and the v1-documentation-only `model`/
  `tools`); the **body is that seat's system prompt**. `convene` copies these
  from the plugin's `personalities/` library, and from then on they're the
  user's to customize — `qa-engineer.md` shows a hand-edit appended to the
  persona for this council only.
- **Memory** is **one markdown file per topic**, not a single log. After a
  `meeting` or `work` session, the chair creates or updates the relevant
  topic file with the decision and its *why* — short, not a transcript.
- **Scratchpad** is append-only, one file per session, named
  `<YYYYMMDD-HHMMSS>-<slug>`. Every seat reads it before speaking. A live
  scratchpad lives under `scratch/` (gitignored, as shown by the rate-limiter
  meeting still in progress); at session end the chair **archives** it to
  `records/<id>.scratch.md` rather than deleting it, so it survives as the audit
  artifact the dissent-preservation gate is checked against (see the
  `extract-retry-helper` work session's `.scratch.md`).
- **Record** is the durable synthesis: a single recommendation, the reasoning
  trail, and **preserved dissent**. Named like the scratchpad it came from. The
  `Mode` field is `meeting`, `work`, `frame`, or `plan`; all share the format. The
  work example also shows a `user`-owned follow-up — `work` hands the merge to the
  human rather than auto-merging.
- **Initiative** is the long-horizon tier: a `BRIEF.md` (framed problem, written by
  a `meeting --frame` session) and a `ROADMAP.md` (decomposition, written by a
  `work --plan` session), evolving across sessions under `initiatives/<slug>/`.
  They are **chair-written into the main `.council/`** and each revision is also an
  immutable record — `frame` wrote the BRIEF, `plan` wrote the ROADMAP — so the
  evolving docs stay auditable. Note the `Conventions (locked)` block in the BRIEF
  (the definitions held fixed downstream) and the `T<phase>.<seq>` task IDs with
  dependencies + one acceptance criterion each in the ROADMAP.

The cross-links are intentional: the `job-queue` meeting produced both
`records/20260603-093000-adopt-job-queue.md` and the `memory/job-queue.md` topic
file, and each points at the other. The same closure binds the initiative tier —
the `frame` record's `→ brief:` line and the BRIEF's `## Revisions` `→ record:`
line point at each other, as do the `plan` record and the ROADMAP.
