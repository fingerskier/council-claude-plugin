---
name: council-orchestrator
description: Orchestrates a council of personality "seats" for Claude and Codex. Use when the user runs /council, asks to convene a council, hold a council meeting, inspect council info, have the council work on a task, frame/scope a question, or plan/decompose an initiative. Handles the convene, info, meeting, and work verbs — including meeting's `--frame` scoping mode (writes a BRIEF) and work's `--plan` decomposition mode (writes a ROADMAP) for long-horizon initiatives — by reading .council/, spawning seat workers, driving the shared scratchpad, and having the chair synthesize.
---

# Council Orchestrator

A **council** is a set of named **seats** (personalities) plus a **chair** that
routes them and synthesizes their output. This skill runs the three council
verbs. You are the orchestrator - you do not voice the seats yourself; you spawn
a worker per seat using the host's worker facility carrying that seat's persona,
and you let the chair route and synthesize.

## Host adapter

The council's durable mechanics are host-neutral: bundled `templates/` and
`personalities/` seed a project-local `.council/`, and sessions write
`.council/scratch/`, `.council/records/`, and `.council/memory/`. Only the entry
point, plugin-root variable, and worker-spawn tool differ by host.

- **Claude Code:** the user invokes `commands/council.md` as `/council ...`.
  Treat `${CLAUDE_PLUGIN_ROOT}` as `COUNCIL_PLUGIN_ROOT`. Spawn seats with the
  Claude `Task` tool. The initiative modes are flags on the existing verbs:
  `/council meeting --frame "<question>"` and `/council work --plan` (no new
  top-level verbs — the surface stays four verbs).
- **Codex:** the user invokes the skill conversationally, e.g.
  `council convene software-team`, `council info`,
  `council meeting "<task>"`, or `council work "<task>"`. The initiative modes
  are spoken the same way: `council meeting --frame "<question>"` (or "frame this
  question: …") and `council work --plan` (or "plan the active initiative"). Resolve
  `COUNCIL_PLUGIN_ROOT` as the installed plugin root that contains this
  `skills/council-orchestrator/SKILL.md` file plus the sibling `templates/` and
  `personalities/` directories. For seat workers, use `multi_agent_v1.spawn_agent`
  when available; if the tool is not loaded, discover it with `tool_search` using
  a query like `multi-agent spawn subagent`.

When the user asks to run a council meeting or work session in Codex, that
request is explicit permission to use sub-agents as the council's execution
mechanism. Do not set a model override for spawned agents unless the user
explicitly requests it.

## Where things live

- **Plugin library (read-only):** `COUNCIL_PLUGIN_ROOT/templates/*.yaml` and
  `COUNCIL_PLUGIN_ROOT/personalities/*.md`. The source material `convene`
  copies from.
- **The convened council (user-owned):** `.council/` in the working repo.
  ```
  .council/
  ├── council.yaml        # active council: name, chair, seats, work_budget
  ├── seats/<seat>.md     # editable copies of the seat personalities
  ├── memory/<topic>.md   # long-term council memory: one file per topic
  ├── scratch/<id>.md     # live shared scratchpad for one meeting/work session
  ├── records/<id>.md     # durable synthesized outputs
  ├── worktrees/<id>/     # git worktrees for `work` sessions (ephemeral)
  ├── active-initiative   # one line: the slug of the current initiative (committed; optional)
  └── initiatives/<slug>/ # long-horizon initiatives (see "Initiative tier" below)
      ├── BRIEF.md        #   framed problem: scope, conventions, success criteria (from `meeting --frame`)
      └── ROADMAP.md      #   decomposition: phases → tasks with deps + acceptance (from `work --plan`)
  ```

  The first six entries are the **session** tier (`scratch/`, `records/`) and the
  **topic** tier (`memory/`). `initiatives/` is the **initiative** tier: a framed
  problem (`BRIEF.md`) and its decomposition (`ROADMAP.md`), evolving across
  sessions, distinct from per-session records (immutable) and per-topic memory
  (accretive). Every initiative doc is **chair-written into the main `.council/`**
  (never by a seat, never inside a worktree), and each revision is also captured by
  an immutable session `records/<id>.md`, so the evolving docs stay auditable.

## Preflight (every verb except `convene`)

Read `.council/council.yaml`. If it does not exist, tell the user the council
hasn't been convened yet and to run `/council convene [template]`, then stop.
Otherwise note the `chair`, the `seats`, and `work_budget`.

The **chair** is whichever seat `council.yaml` names. The chair routes (picks
which seats are relevant, who speaks/acts next) and synthesizes. Read the
chair's persona from `.council/seats/<chair>.md`.

---

## Verb: convene

Create or recreate `.council/` from a template. No task runs.

1. **Pick the template.** If the user gave a name, use it. Otherwise list the
   templates in `COUNCIL_PLUGIN_ROOT/templates/` with their `description` as
   text, then ask which to use with the **AskUserQuestion** tool: one question,
   up to four template options — `software-team` first, labeled
   `(Recommended)` — each option's description taken from the template's
   `description` field. When there are more than four templates, the text list
   above keeps the rest visible and the user picks an unlisted one by typing
   its name via "Other". (If the tool is unavailable, ask in plain
   conversation; default `software-team`.)
2. **Guard existing council.** If `.council/council.yaml` already exists, warn
   that recreating will overwrite **`council.yaml` and the `seats/` copies** (where
   hand-edits live) and confirm before proceeding — ask with the
   **AskUserQuestion** tool, options **Cancel — keep the current council**
   first and **Recreate — overwrite roster and seats** second (plain
   conversation if the tool is unavailable). Do not clobber without a yes.
   Recreate is **scoped to those two**: it **never deletes `memory/`, `records/`,
   `scratch/`, `initiatives/`, or the `active-initiative` pointer**. The council's
   accumulated memory, audit trail, and in-flight initiatives are its most valuable,
   least-recreatable state, so a re-convene rebuilds the roster *around* them — it
   does not reset the council. (Even a confirmed recreate leaves memory, records,
   and initiatives intact; a user who truly wants a clean slate removes `.council/`
   by hand.) The active-initiative pointer lives in its **own file**
   (`.council/active-initiative`), deliberately **not** a `council.yaml` field —
   `council.yaml` is rewritten on recreate, so a pointer kept there would be
   silently clobbered while the `initiatives/` tree it names survived.
3. **Create any missing tree dirs** — `mkdir -p`, never destructive:
   `.council/seats/`, `.council/memory/`, `.council/scratch/`, `.council/records/`,
   `.council/initiatives/`. Existing `memory/`, `records/`, and `initiatives/`
   content is left untouched (step 2).
4. **Write `.council/council.yaml`** from the chosen template
   (`COUNCIL_PLUGIN_ROOT/templates/<name>.yaml`).
5. **Copy the seats.** For each seat in the template's `seats:` list, copy
   `COUNCIL_PLUGIN_ROOT/personalities/<seat>.md` to `.council/seats/<seat>.md`.
6. **Leave `memory/` empty.** Memory is one markdown file per topic, created by
   the chair when a meeting or work session concludes — there's nothing to seed
   at convene time. (The directory exists from step 3.)
7. **Write `.council/.gitignore`** so ephemeral state isn't committed:
   ```
   scratch/
   worktrees/
   ```
8. **Report**: the council name, chair, and roster, and tell the user the files
   under `.council/seats/` and `.council/council.yaml` are theirs to edit
   (tweak a voice, add/remove a seat, change the chair or budget).

---

## Verb: info

Read-only. Print a concise table of the convened council. No session, no
workers, no writes.

1. **Preflight** as above — if `.council/council.yaml` is missing, tell the user
   to `convene` first and stop.
2. **Read the roster.** From `council.yaml` take `name`, `chair`, the `seats`
   list, `work_budget`, and the optional `memory_budget`. For each seat, read the
   frontmatter of `.council/seats/<seat>.md` for its `title` and `voice`.
3. **Print a table** — one row per seat, in `council.yaml` order, with the chair
   marked. Columns: seat (the `name`), title, voice. Head it with the council
   name, the chair, and the budget. For example:

   ```
   Council: software-team — chair: staff-engineer
   Budget: max_turns 12 · scratch 200k · memory 8k

     Seat                Title                Voice                                           Chair
     ──────────────────  ───────────────────  ──────────────────────────────────────────────  ─────
     staff-engineer      Staff Engineer       rigorous, systems-thinking, plain-spoken        ★
     security-engineer   Security Engineer    adversarial, threat-modeling, specific
     qa-engineer         QA Engineer          meticulous, edge-case-hunting, evidence-driven
     product-manager     Product Manager      user-centered, prioritizing, outcome-driven
   ```

   Pull `title`/`voice` straight from each seat's frontmatter; if a field is
   absent, leave it blank. **Omit budget fields the council doesn't set** — this
   includes the optional `max_wall_seconds` (render it, e.g. append ` · wall 1800s`,
   **only when present** in `work_budget`) and the optional
   `memory_budget.manifest_max_bytes` (append ` · memory 8k` **only when set `> 0`**).
   The example above sets no `max_wall_seconds`, so the banner omits it; it does set
   `memory_budget` (the default templates do), so ` · memory 8k` shows. Keep it to the
   table plus the header — no commentary unless the user asks.
4. **Active initiative (only if one exists).** If `.council/active-initiative`
   names a slug whose `.council/initiatives/<slug>/` exists, print one line under
   the table: the slug, which artifacts exist (`BRIEF` and/or `ROADMAP`), and — when
   `ROADMAP.md` is present — the task progress (`<done>/<total>` from the task
   checkboxes). For example:

   ```
   Initiative: distillation-vs-scratch — BRIEF ✓ · ROADMAP ✓ (2/7 tasks)
   ```

   Fall back gracefully: no pointer or no `initiatives/` content → print nothing
   (or, if the user asked specifically about initiatives, say there is no active
   initiative and to run `/council meeting --frame "<question>"`). A stale pointer
   (names a slug with no directory) is treated as "no active initiative", not an
   error.

---

## Verb: meeting

A human-in-the-loop round-table. Seats speak in turn on a shared scratchpad; you
the orchestrator pause each round for the user's input; the user concludes; the
chair synthesizes. Seats are **read-only** (no worktree, no commits) — and that
read-only instruction is **injected into every meeting seat's prompt** (see
*Spawning a seat*), not merely assumed.

1. **Session id:** `<YYYYMMDD-HHMMSS>-<short-slug-of-task>`.
2. **Open the scratchpad** `.council/scratch/<id>.md` with a header. Pin the
   fields and heading conventions exactly (see the example
   `examples/sample-council/scratch/20260605-141200-rate-limiter.md`):
   ```
   # Scratchpad — meeting

   <1-2 sentence note that this is ephemeral, append-only working memory.>

   - **Task:** <the task / topic>
   - **Session:** <id>
   - **Started:** <YYYY-MM-DD HH:MM>
   - **Chair:** <chair seat name>
   - **Seats (all seats speak in a meeting):** <comma-separated seat names>

   ---
   ```
   Then each round is appended under a `## Round N — <seat>` heading, and each
   user pause under a `## User input after Round N` heading.
3. **All seats participate.** A `meeting` has no seat selection — every seat in
   `council.yaml` speaks. Record the roster in the scratchpad.
4. **Round loop:**
   a. For each seat **in turn**, spawn a seat worker (see *Spawning a
      seat* below) with the task and the current scratchpad. Append its response
      to the scratchpad under a `## Round N — <seat>` heading.
   b. After the round, give the user a tight summary of what each seat said —
      a markdown table, one row per seat (`Seat | Position | Dissent?`), the
      position compressed to a line and the dissent column flagging any seat
      that marked dissent this round. Then **ask for their input** with the
      **AskUserQuestion** tool — one question ("Where to next?") with two
      options:
      - **Another round** — run the next round on the current course;
      - **Conclude** — end the meeting; the chair synthesizes.
      A steer, a constraint, or a new question arrives as free text via the
      built-in "Other" choice — that free text *is* the user input the next
      round builds on. Append whatever the user chose or typed to the
      scratchpad under `## User input after Round N`: the selected option and
      any free text verbatim, so the audit trail captures the steer exactly.
      (If the AskUserQuestion tool is unavailable, ask in plain conversation
      and wait — the pause is the contract, not the widget.)
   c. Repeat rounds until the user concludes.
5. **Conclude:** spawn the **chair** as a worker over the full scratchpad +
   memory to synthesize: a unified recommendation, preserved dissents (who
   disagreed and why), and any open threads.
6. **Record + memory:** write the synthesis to `.council/records/<id>.md` using
   the pinned **record file** structure (*Synthesis contract* below; `Mode:
   meeting`). Then fold durable takeaways into memory **by topic** — for each
   topic the session touched, create or update `.council/memory/<topic>.md`
   (pinned **memory topic** structure; follow the **topic naming** rule) with the
   decision and its *why* (short, not a transcript). Run the **post-synthesis
   conformance check** before continuing, then **archive the scratchpad** — rename
   `.council/scratch/<id>.md` to `.council/records/<id>.scratch.md`. Do **not**
   delete it: it's the audit artifact Gate 1 is checked against, and a future
   review can re-verify that no dissent was flattened only if it survives.
   Then **commit** the record, the archived scratch, and the memory files — the
   gates are defined over committed artifacts, so an uncommitted record/memory
   leaves the audit trail unverifiable from the tree (write *and* commit, not
   write alone).
7. **Report** the synthesis to the user and point at the record file.

---

## Verb: work

Autonomous take-turns until done. The chair selects seats and drives the loop
with **no user input**; seats work in a **git worktree**; on completion the
chair synthesizes and records, then **declares done and hands the merge to the
user** (it never auto-merges). This verb scales: a quick question resolves in a
turn or two; a bounded implementation grinds for many.

1. **Session id:** as above.
2. **Set up the worktree** (if this is a git repo):
   ```
   git worktree add -b council/work-<id> .council/worktrees/<id> HEAD
   ```
   Seats do their file work with this directory as cwd. (If not a git repo, work
   in place and note that isolation is unavailable.)
3. **Open the scratchpad** `.council/scratch/<id>.md` with a header. Pin the
   fields and heading conventions exactly (see the archived example
   `examples/sample-council/records/20260606-101500-extract-retry-helper.scratch.md`):
   ```
   # Scratchpad — work

   <1-2 sentence note that this is ephemeral, append-only working memory.>

   - **Task:** <the task>
   - **Session:** <id>
   - **Started:** <YYYY-MM-DD HH:MM>
   - **Started (epoch):** <output of `date +%s` at session open — the machine clock the wall-clock trigger reads; do not derive elapsed time from the human `Started` field>
   - **Chair:** <chair seat name>
   - **Seats (chair-selected subset — work does not run all seats):** <comma-separated seat names>

   ---
   ```
   Then each turn is appended under a `## Turn N — <seat>` heading (work is
   chair-routed turns, not rounds, and there is **no** user-input section).
4. **Read the budget** from `council.yaml` `work_budget` (`max_turns`,
   `scratch_max_bytes`, and the **optional** `max_wall_seconds`). `max_turns` and
   `scratch_max_bytes` are hard stops you can measure exactly — track turns taken
   and the scratchpad byte size as you go. For `max_wall_seconds`: record
   `date +%s` at session open into the header `**Started (epoch):**` field, and at
   each turn boundary compare a fresh `date +%s` against it. It is **armed only
   when present and > 0** — `absent | 0 | negative → unarmed` (absence is the
   off-switch; most councils don't set it). It is honest only at **turn-boundary
   granularity**: a long turn can overshoot the target, because it bounds when the
   *next* turn starts, not a mid-turn cut. (There is no token cap: the
   orchestrator has no reliable per-turn token count, so a token budget couldn't
   fire — `max_turns` bounds how long a run goes; token spend rides along with it.)
5. **Chair selects seats** relevant to the task; record in the scratchpad.
6. **Take-turns loop (chair-driven):**
   a. The **chair** reads the scratchpad and decides **who acts next** and the
      concrete sub-goal for this turn.
   b. Spawn that seat as a worker (see *Spawning a seat*) with the task, the
      sub-goal, and the scratchpad, pointed at the worktree by its **absolute
      path** — most worker tools can't set the worker's cwd, so the worktree is named
      in the prompt, not as a working directory. It may read/edit files and run
      commands **under** the worktree. After it returns, **verify its edits landed
      in the worktree, not the main tree**: `git -C .council/worktrees/<id> status`
      should show the changes while the main working tree stays clean. Append its
      turn to the scratchpad.
   c. The **chair** evaluates whether to continue. **Stop on whichever of these
      five fires first:**
      - **chair says done** — the task is genuinely complete;
      - **budget** — `max_turns` reached: a hard stop, a turn count you track
        exactly. (This is the run-length cap; there is no separate token cap —
        see step 4.);
      - **scratchpad size** — the scratchpad has grown past `scratch_max_bytes`
        (a hard stop: byte size is measured exactly);
      - **wall-clock** — `max_wall_seconds` is set and `now − Started(epoch) ≥
        max_wall_seconds`, where `now` is `date +%s` read at this turn boundary
        and `Started(epoch)` is the `date +%s` recorded in the scratchpad header
        at session open. A hard stop measured exactly — but **only at turn
        boundaries**: it bounds when the *next* turn starts, not a mid-turn
        interrupt, so a turn already running finishes first and total time can
        overshoot the budget by up to one turn's duration. **Unarmed** when the
        field is absent, `0`, or negative;
      - **user stop** — the user asked to halt the run.
      Otherwise, loop.
7. **Synthesize:** spawn the chair over the full scratchpad + memory to produce
   the outcome (what was built/decided, trade-offs taken, preserved dissent).
8. **Record + memory:** write `.council/records/<id>.md` using the pinned
   **record file** structure (*Synthesis contract* below; `Mode: work`); fold
   takeaways into memory **by topic** (create/update `.council/memory/<topic>.md`
   per the pinned **memory topic** structure and **topic naming** rule). Run the
   **post-synthesis conformance check**, then **archive the scratchpad** — rename
   `.council/scratch/<id>.md` to `.council/records/<id>.scratch.md` (don't delete
   it; it's the audit artifact Gate 1 is checked against).
9. **Commit, in two places that don't cross.** The gates are defined over
   committed artifacts, so an uncommitted audit trail can't be verified from the
   tree — commit both halves, and keep them apart:
   - **The task's file changes** stay **in the worktree, on the `council/work-<id>`
     branch** (`git -C .council/worktrees/<id> add -A && git -C
     .council/worktrees/<id> commit -m "<summary>"`). This is exactly what the
     user's later `git merge --no-ff council/work-<id>` lands — the work isn't
     mergeable until it's committed there.
   - **The audit trail** (record + archived scratch + memory) lives in the **main**
     `.council/`, not the worktree, and is committed **there, on the current
     branch** — *not* on the work branch. Off the work branch, the record survives
     whether or not the user ever merges, and the merge handoff stays purely about
     the code.
10. **Declare done — do not auto-merge.** Leave the branch and worktree in place
    and hand the user a summary plus the exact commands to merge when *they*
    choose to, and to clean up:
    ```
    git merge --no-ff council/work-<id>
    git worktree remove .council/worktrees/<id>
    ```
    The user owns the merge decision; the chair never lands changes on the
    working tree itself.
11. **Report** the outcome, the record path, and the merge status (always
    deferred with instructions).

---

## Initiative tier: `frame` & `plan` modes

A **long-horizon initiative** takes an under-specified goal, interrogates it into
a well-posed problem, and decomposes that into an ordered plan — then carries both
across sessions. It is **not** a new pair of verbs: it is two **modes** layered on
the verbs you already have, so the surface stays four verbs.

- **`meeting --frame "<question>"`** — a `meeting` with an *inverted* objective.
  The table's job is to surface what is unknown, unstated, or ambiguous, **not** to
  answer. On conclusion the chair writes a **`BRIEF.md`** (a framed problem), not a
  verdict.
- **`work --plan`** — a `work` session whose objective is to *decompose*. The
  decomposer drafts, the table red-teams the decomposition, the chair writes a
  **`ROADMAP.md`** (phases → tasks with dependencies and acceptance criteria). It
  produces a document, not code, so it runs **without a worktree**.

These reuse the `meeting` and `work` machinery almost entirely; only the objective
and the output artifact change. Three rules are load-bearing and apply to both:

1. **Chair writes the artifact, into the main `.council/`.** Seats contribute
   analysis only (they are read-only, exactly as in `meeting`); the **chair** writes
   `BRIEF.md`/`ROADMAP.md` at synthesis, into the main `.council/initiatives/<slug>/`
   — never a seat, never inside a worktree. (A doc both *read on entry* and
   *written on exit* by an autonomous loop must stay chair-mediated, like memory.)
2. **Every revision is also an immutable record.** Each `frame`/`plan` session
   writes a normal `records/<id>.md` (`Mode: frame` or `Mode: plan`) capturing the
   deliberation and its dissents, and the artifact's `## Revisions` log back-links
   it. The evolving doc is the *current* state; the records are its *history* — so
   auditability survives in-place edits.
3. **The artifacts are injected as pointers, read on demand** — like the memory
   manifest, never their full bodies in every spawn (see *Memory injection*).

### Resolving the active initiative

The active initiative is named by `.council/active-initiative` (one line: a slug).
Each mode resolves which initiative it touches in this order: (1) an explicit
`--initiative <slug>` (or trailing slug arg) wins; (2) else the
`.council/active-initiative` pointer; (3) else, if exactly one initiative exists,
use it; (4) else — zero initiatives, or several with no pointer/arg — `frame`
**creates** one (slug = kebab-case of the question) and `plan` **stops** and tells
the user to `frame` first (or to pass `--initiative`). A successful `frame`/`plan`
**sets** the pointer to the initiative it touched. A pointer naming a missing
directory is treated as "no active initiative", never an error.

### Mode: `meeting --frame "<question>"`

Run the **Verb: meeting** loop exactly — all seats, sequential on the shared
scratchpad, per-round `AskUserQuestion` pause, the user concludes — with these
differences:

- **Session id / scratchpad header** use `frame` in place of `meeting`
  (`# Scratchpad — frame`).
- **Inverted objective, injected into every seat's prompt** (in addition to the
  meeting read-only line): *"This is a framing session. Your job is to surface what
  is unknown, unstated, ambiguous, or assumed about this goal — the questions that
  must be answered before it is well-posed — not to answer it. Propose scoping
  questions, hidden assumptions, missing definitions, and the criteria by which
  'done' should be judged."* The heterogeneous roster pays off directly here:
  `security-engineer` probes the trust boundary, `qa-engineer`/`methodologist` hunt
  unstated edge cases and confounders, `product-manager` asks whether it is the
  right problem, `researcher` flags the gap in what is actually known.
- **Conclusion (diverge → converge).** The chair synthesizes a single **sharp,
  well-posed question** plus the framed problem — it must **not** broaden the
  question into a blander consensus one. Unresolved scoping traps are **preserved as
  `## Open questions`**, not flattened.
- **Resolve the slug** (see above). If `initiatives/<slug>/BRIEF.md` already
  exists, this is a **revision**: confirm first with `AskUserQuestion`
  (`Cancel — keep the current brief` / `Revise — update the brief`), like the
  `convene` recreate guard; never silently overwrite. On revision, **append** a
  `## Revisions` line and edit in place — do not discard prior sections without the
  deliberation supporting it.
- **Write outputs:** the chair writes `.council/initiatives/<slug>/BRIEF.md`
  (pinned format below) into the main tree, writes the immutable
  `records/<id>.md` (`Mode: frame`), archives the scratchpad to
  `records/<id>.scratch.md`, runs the **Initiative conformance check**, sets
  `.council/active-initiative` to `<slug>`, then **commits** the brief, the record,
  the archived scratch, and the pointer. `frame` needs no git repo and no
  worktree (same as `meeting`/`info`).

### Mode: `work --plan`

Run the **Verb: work** take-turns loop (chair-routed, no user input, bounded by
`work_budget`) with these differences:

- **No worktree.** `plan` writes a document, not code, so there is no
  `git worktree add`, no merge handoff, and no isolation step. The scratchpad
  header uses `# Scratchpad — plan`.
- **Resolve the active initiative** (see above) and **require an existing
  `BRIEF.md`**. If there is none, stop and tell the user to
  `/council meeting --frame "<question>"` first.
- **Draft-then-review loop.** Turn 1: the **decomposer** drafts the roadmap from
  the brief — this is the chair when the chair is a planning persona
  (`research-lead`), otherwise the chair assigns the most decomposition-minded seat.
  Inject: *"Draft a ROADMAP from this BRIEF: phases → tasks with stable IDs,
  explicit dependencies (or `none`) so independent tasks are identifiable, and one
  acceptance criterion per task — for research, the evidence that would settle or
  falsify each sub-question."* Following turns: the other seats **red-team the
  decomposition** — missing dependencies, vague or unfalsifiable acceptance
  criteria, wrong phase cuts, tasks that are not independently answerable. The chair
  revises and decides done (or budget/scratch/user-stop fires, as in `work`).
- **Write outputs:** the chair writes `.council/initiatives/<slug>/ROADMAP.md`
  (pinned format below) into the main tree, writes the immutable `records/<id>.md`
  (`Mode: plan`, dissents preserved on contested decompositions), archives the
  scratchpad, runs the **Initiative conformance check**, updates
  `.council/active-initiative`, then **commits** the roadmap, record, archived
  scratch, and pointer — all on the current branch (no work branch, since there is
  no worktree).

### `BRIEF.md` (pinned format)

```
# Brief — <prose title for the initiative>

<1-3 sentence framing of what this initiative is and why it exists.>

- **Initiative:** <slug>
- **Opened:** <YYYY-MM-DD HH:MM>
- **Status:** <forming | framed | planned | active | settled | abandoned>
- **Chair:** <chair seat name>

## Question
<the single sharp, well-posed question this initiative answers.>

## Scope
<what is in scope.>

## Out of scope
<what is explicitly excluded — required; the literal `none` if nothing.>

## Assumptions
- <assumption>

## Conventions (locked)
<operational definitions, units/notation, inclusion/exclusion criteria, interfaces,
or source-quality bar that must stay fixed downstream. Frozen once Status leaves
`forming`: a later change appends a Revisions entry, it does not overwrite.>

## Success criteria
- [ ] <a check that can be judged true/false — for research, the evidence that would settle the question.>

## Open questions
- <an unresolved scoping trap the table surfaced — or the literal `none`.>

## Revisions
- <YYYY-MM-DD HH:MM> framed → record: `records/<id>.md`
```

### `ROADMAP.md` (pinned format)

```
# Roadmap — <prose title for the initiative>

- **Initiative:** <slug>
- **Brief:** `BRIEF.md`
- **Updated:** <YYYY-MM-DD HH:MM>
- **Chair:** <chair seat name>

## Phase 1 — <phase title>
### T1.1 — <task / sub-question title>
- **Depends on:** <comma-separated task IDs | none>
- **Acceptance:** <the single criterion that discharges this task — for research, what evidence settles or falsifies it.>
- [ ] open

### T1.2 — <task title>
- **Depends on:** T1.1
- **Acceptance:** <criterion>
- [ ] open

## Phase 2 — <phase title>
### T2.1 — <task title>
- **Depends on:** T1.2
- **Acceptance:** <criterion>
- [ ] open

## Revisions
- <YYYY-MM-DD HH:MM> drafted → record: `records/<id>.md`
```

Task IDs are `T<phase>.<seq>` (e.g. `T1.1`), stable for the life of the initiative
— never reused or renumbered (renumbering would dangle a later discharge link). A
task's status line is `- [ ] open` until it is discharged; discharging a task is the
deferred `work`-against-plan step (below), which will flip it to
`- [x] done → record: \`records/<id>.md\``. `/council info` counts these checkboxes
for its `<done>/<total>` progress.

### Initiative conformance check

Run **before archiving the scratchpad** (so it stays re-checkable), exactly like the
**Post-synthesis conformance check**. The dissent gate (Gate 1) applies to the
`frame`/`plan` **record** unchanged. Two added gates and a closure check:

- **Gate 3 — `BRIEF` is gateable.** `BRIEF.md` has `## Scope`, `## Out of scope`
  (non-empty or the literal `none`), `## Success criteria` with **≥1** `- [ ]`/`- [x]`
  line (a brief with no success criteria **fails**), `## Open questions` (non-empty or
  `none`), and a `## Revisions` line; `Status` is one of the enum values; once
  `Status` ≠ `forming`, `## Conventions (locked)` is present and non-empty.
- **Gate 4 — every `ROADMAP` task carries acceptance + a dependency edge.** Each
  `### T<phase>.<seq>` has a unique ID, a `- **Depends on:**` value that is the
  literal `none` or a comma-separated list of IDs that each resolve to a real task in
  this file (no dangling edge — and the dependency graph must be acyclic), a non-empty
  `- **Acceptance:**` line, and a status checkbox.
- **Closure — record ↔ artifact (bidirectional, mechanical).** The `frame`/`plan`
  record ends with a closure line — `→ brief: \`initiatives/<slug>/BRIEF.md\`` (frame)
  or `→ roadmap: \`initiatives/<slug>/ROADMAP.md\`` (plan) — and the artifact's newest
  `## Revisions` line names this record as `→ record: \`records/<id>.md\``. Assert both
  exist and point at each other, the same way Gate 2 closes record ↔ memory. (The
  record's existing `→ memory updated:` line is still required; for `frame`/`plan` it
  is usually `none`.)

### Deferred (a planned follow-up, not in this version)

- **`STATE.md` continuity** — a per-initiative ledger (current phase, completed
  tasks, next ready task, open threads) read on entry and updated on session end. For
  now, the `BRIEF`/`ROADMAP` files and the discharging records carry the state.
- **`work`-against-plan** — `work` picking the next ready `ROADMAP` task (deps
  satisfied), running its loop against that task, and binding the discharging
  `records/<id>.md` back to the task (flipping its checkbox). This is the step that
  needs the record↔task gate; until it lands, tasks stay `- [ ] open` and are
  discharged by ordinary `work "<task>"` sessions tracked by hand.

---

## Spawning a seat

Spawn each seat with the host's worker tool:

- **Claude Code:** use the `Task` tool with `subagent_type: general-purpose`,
  running in the background only if you are fanning out a parallel set.
- **Codex:** use `multi_agent_v1.spawn_agent`. Use `agent_type: worker` for
  `work` turns that may edit files. For read-only meeting turns, use the default
  agent type unless the seat's subtask is specifically codebase exploration. Call
  `wait_agent` for the sequential seat result, then `close_agent` after the
  result is captured.

Meeting and work are sequential, so spawn one seat at a time and wait. Build the
prompt as:

```
You are acting as a council seat. Fully adopt this persona — its priorities,
voice, and judgment — and respond in character.

<persona>
{contents of .council/seats/<seat>.md, body below the frontmatter}
</persona>

Council memory — manifest (durable context from past sessions; a pointer index,
not the content — one line per topic, newest-updated first):
{the memory manifest — built per "Memory injection (two-tier)" below — or "none yet"}

Shared scratchpad (the conversation so far — read it before you speak):
{current contents of .council/scratch/<id>.md}

Task: {the user's task}
{For work turns, also: "This turn's sub-goal (assigned by the chair): ..."}
{For work, also: "All your file work happens in the git worktree at the absolute
 path .council/worktrees/<id>/ — treat that subtree as the project root. The
 worker tool may not change your working directory, so address every read, edit, and
 command at a path *under* that worktree; do not touch files outside it. Report the
 paths you changed so the chair can confirm they landed in the worktree."}
{For meeting, also: "This is a meeting and you are read-only: contribute analysis
 and prose only — do not edit files, run state-mutating commands, or commit.
 Filesystem changes are a `work` session's job, never a meeting's."}
{Always, re: memory — "The memory block above is a manifest of pointers, not
 content. Before you rely on any topic — its decision, constraints, or standing
 dissent — Read its full file at the path shown (for work it lives under the main
 repo's .council/memory/, whose absolute path is given above). Never infer a topic's
 content from its one-line summary; a topic's standing dissent is not in the manifest
 at all. Reading is non-mutating, so it is allowed in a read-only meeting too."}

Respond as this seat, building on the scratchpad rather than repeating it. If
you disagree with where the council is heading, say so plainly and mark it as
dissent — dissents are preserved in the record, not papered over. Be concise
and stay in your lane.
```

**Model/effort (v1):** do **not** set a per-seat model. Every seat and the chair
run on the user's current default model/effort. A seat's `model:` and `tools:`
frontmatter are documentation for now — preserve them, don't enforce them. (Per-
seat model routing for cost is declined — see PLAN §9; no phase currently
enforces it.) The **chair** is spawned the same
way as any seat, but its task is to *route* (pick who's next / decide done) or to
*synthesize* (unified recommendation + dissents) rather than to give one more
opinion.

### Memory injection (two-tier)

Memory is injected as a **bounded manifest of pointers**, never the whole corpus.
Concatenating every `.council/memory/*.md` body into every spawn grew without bound
as topics accumulated and was re-paid on every seat and every turn. A manifest keeps
the always-injected slice small **without sacrificing recall** — every topic is still
listed, and any seat can open any file it needs.

**Build the manifest.** One line per topic file in `.council/memory/`, ordered
most-recently-updated first (file mtime, or the newest `→ record:` back-link in the
file), each line:

```
- `memory/<topic>.md` — <title: the text after "# Memory:"> — <the first non-empty
  line under that file's `## Decision`>
```

With no topic files, the manifest is the literal `none yet`.

**Read on demand, don't guess.** The manifest is an index, not the content. A seat or
the chair that needs a topic **Reads its full file before relying on it** — it never
infers a decision, constraint, or standing dissent from the one-line summary. A
topic's `## Standing dissent` is deliberately *not* in the manifest, so the summary is
never a safe substitute for the file. Reads are non-mutating, so they are permitted in
a read-only `meeting`. For `work`, topic files live in the **main** `.council/memory/`,
not the worktree — give the worker the absolute path, the same way you give it the
worktree path.

**Bound it with `memory_budget` (optional).** In `council.yaml`:

```yaml
memory_budget:
  manifest_max_bytes: 8000   # cap on the injected manifest; unset/0 = uncapped
```

Armed only when set `> 0` (mirrors `max_wall_seconds`: absent, `0`, or negative = off).
When the manifest would exceed the cap, inject the newest-updated topics up to the cap
and append one final line — `- (+N older topics — list .council/memory/ and Read as
needed)` — so the remainder stays **discoverable rather than silently dropped**.
Uncapped, the whole manifest goes in; at one short line per topic it is bounded by
topic count, which itself grows sub-linearly because topics are reused and updated
(per the **topic naming** rule below), not spawned per session.

**Initiative docs follow the same discipline.** When a session touches an active
initiative, inject the **paths** of its `BRIEF.md`/`ROADMAP.md` (and a one-line
note that they exist), not their bodies — the decomposer in a `plan` session Reads
`BRIEF.md` on demand, just as a seat Reads a memory topic. Inlining the full
evolving docs into every spawn would reintroduce the unbounded-context growth the
manifest design exists to prevent.

## Synthesis contract (the chair's output)

Whenever the chair synthesizes, produce:

1. a **unified recommendation / outcome** — the single headline answer;
2. a **`## Dissents (preserved)`** section — where seats disagreed and why,
   preserved not flattened (the heading is literal, including the parenthetical);
3. (for the record file) the **reasoning trail** so the deliberation is
   auditable.

A synthesis that erases disagreement is just one opinion in a trench coat —
keep the strongest dissent visible.

The synthesis is written to two places with fixed structures: the **record
file** (one per session) and one or more **memory topic files**. Both formats
are pinned below; `meeting` and `work` share them (the only difference is the
`Mode` field).

### Record file (`records/<id>.md`)

The filename **is** the session id. The H1 is a short prose title for the
session, distinct from the slug. Concrete template (see
`examples/sample-council/records/20260603-093000-adopt-job-queue.md`):

```
# Record — <prose title for the session>

<1-3 sentence preamble.>

- **Session:** <id, i.e. YYYYMMDD-HHMMSS-slug>
- **Mode:** <meeting | work>
- **Concluded:** <YYYY-MM-DD HH:MM>
- **Chair:** <chair seat name>
- **Seats:** <comma-separated seat names that participated>
- **Task:** <the task / topic>

## Recommendation
<the unified recommendation / outcome — what was decided or built.>

## Reasoning trail
<the auditable why: the considerations, alternatives weighed and rejected.>

## Dissents (preserved)
- **<seat>:** <the dissent, in that seat's voice, not flattened.>

## Follow-ups
- [ ] <action> (owner: <seat>)

→ memory updated: `memory/<topic>.md`
```

The six bold fields are all required and in this order. `Mode` is `meeting`,
`work`, `frame`, or `plan`. `Concluded` uses `YYYY-MM-DD HH:MM`. Each follow-up
owner is a **full seat name** from `council.yaml` (e.g. `qa-engineer`, not `qa`),
or the literal `user` for a handoff the council defers to the human (e.g. the merge
decision). A `frame`/`plan` record additionally carries one initiative-closure line
after `→ memory updated:` — `→ brief: \`initiatives/<slug>/BRIEF.md\`` for `frame`,
`→ roadmap: \`initiatives/<slug>/ROADMAP.md\`` for `plan` — that the **Initiative
conformance check** closes against the artifact's `## Revisions` back-link.

The trailing `→ memory updated:` cross-links every memory topic this session
wrote, **one line per topic**:
- **One topic:** a single line, `→ memory updated: \`memory/<topic>.md\``.
- **Several topics:** one `→ memory updated:` line each, in any order.
- **No durable memory:** exactly one line, `→ memory updated: none`, so the
  absence is explicit rather than a forgotten line (Gate 2 can tell "wrote
  nothing" from "dropped the line").

### Memory topic file (`memory/<topic>.md`)

One file per durable topic — context the seats read on later sessions. Keep it
short: decisions and their *why*, **never a transcript**. Concrete template (see
`examples/sample-council/memory/job-queue.md`):

```
# Memory: <Title Case topic>

<optional 1-2 sentence preamble.>

## Decision
<the durable decision, stated plainly.>
→ record: `records/<id>.md`

## Why
<the reasons — not the round-by-round transcript.>

<topic-specific sections as warranted, e.g. ## Constraints, ## Practice.>

## Standing dissent (<seat>)
<a dissent that should travel with this topic, if any — else omit the section.>
```

`## Decision` and `## Why` are both **required**. `## Decision` ends with one or
more `→ record:` back-links. Each back-link's target is **either** a backticked
`records/<id>.md` path **or** the bare literal `STANDING` (for a standing
practice no single session set) — **never free prose** — optionally followed by a
short parenthetical note. This enum is what makes Gate 2 mechanically checkable:
extract the backticked path (or recognize `STANDING`), assert the file exists and
names this topic back.

**Back-links accrue into a history.** When a later session revises this topic,
**append a new `→ record:` line** (newest last) rather than overwriting the
prior one — the back-links form the topic's record history, mirroring the
reuse-don't-duplicate rule for topic files. (Overwriting would silently dangle
the earlier record's `→ memory updated:` closure.)

`## Why` carries reasons, not transcript: **no `## Round N` headings and no
turn-by-turn conversation belong in memory** — that content stays in the record.

### Topic naming (deterministic)

Pick the topic file name by kebab-casing the **durable subject noun-phrase of
the decision** — not the task phrasing, not the session slug, and no dates.
("Should we adopt a job queue?" → `job-queue`; a decision about how the council
tests → `testing-standards`.) Before creating one, **list the existing
`memory/*.md` files and reuse the file if the subject already has one**;
otherwise create a new file. Updating an existing topic keeps its history and
adds the new decision rather than spawning a near-duplicate file — append a new
`→ record:` back-link for the updating session (newest last); never overwrite the
prior link.

### Post-synthesis conformance check

Two hard gates. **Both MUST pass before you archive the scratchpad** — run them
*while the scratchpad still exists*, since Gate 1 is checked against it. These
catch the silent failures a skim would miss:

1. **Dissents preserved, not flattened.** The record has a literal
   `## Dissents (preserved)` section, and every dissent recorded in the
   scratchpad survives there in its seat's own voice — not summarized away into
   the recommendation. (If there were genuinely no dissents, the section says so
   explicitly rather than being dropped.) Because the scratchpad is **archived,
   not deleted** (`records/<id>.scratch.md`), this gate stays re-checkable after
   the fact — a later review can diff the record's dissents against the archived
   scratchpad.
2. **Cross-link closure (bidirectional), mechanically.** The record's
   `→ memory updated:` lines name every topic file written (or the single literal
   `none` if it wrote none), **and** each named topic file's `## Decision` carries
   a `→ record:` back-link to this record. Every `→ record:` value is a backticked
   `records/<id>.md` path or the literal `STANDING` — never free prose — so this
   gate is a script, not a skim: for each `→ memory updated: memory/X.md`, assert
   `memory/X.md` exists and one of its `→ record:` lines is this record; for each
   topic's `→ record: records/Y.md`, assert `records/Y.md` lists that topic. Both
   directions must close.

The templates above already pin the rest — field order, prose H1, the `Concluded`
`YYYY-MM-DD HH:MM` format, the section names, full-seat-name owners, kebab topic
naming, the `→ record:` enum, no transcript in memory. Follow the templates;
don't re-grade each formatting detail as its own checkbox.
