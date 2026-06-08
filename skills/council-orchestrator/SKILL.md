---
name: council-orchestrator
description: Orchestrates a council of personality "seats" for the /council command. Use when the user runs /council, or asks to convene a council, hold a council meeting, or have the council work on a task. Handles the convene, info, meeting, and work verbs — reading .council/, spawning seat workers, driving the shared scratchpad, and having the chair synthesize.
---

# Council Orchestrator

A **council** is a set of named **seats** (personalities) plus a **chair** that
routes them and synthesizes their output. This skill runs the three council
verbs. You are the orchestrator — you do not voice the seats yourself; you spawn
a worker per seat (via the Task tool) carrying that seat's persona, and you let
the chair route and synthesize.

## Where things live

- **Plugin library (read-only):** `${CLAUDE_PLUGIN_ROOT}/templates/*.yaml` and
  `${CLAUDE_PLUGIN_ROOT}/personalities/*.md`. The source material `convene`
  copies from.
- **The convened council (user-owned):** `.council/` in the working repo.
  ```
  .council/
  ├── council.yaml        # active council: name, chair, seats, work_budget
  ├── seats/<seat>.md     # editable copies of the seat personalities
  ├── memory/<topic>.md   # long-term council memory: one file per topic
  ├── scratch/<id>.md     # live shared scratchpad for one meeting/work session
  ├── records/<id>.md     # durable synthesized outputs
  └── worktrees/<id>/     # git worktrees for `work` sessions (ephemeral)
  ```

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
   templates in `${CLAUDE_PLUGIN_ROOT}/templates/` with their `description`, and
   ask which to use (default `software-team`).
2. **Guard existing council.** If `.council/council.yaml` already exists, warn
   that recreating will overwrite the council files (the user may have
   hand-edited seats) and confirm before proceeding. Do not clobber without a
   yes.
3. **Create the tree:** `.council/seats/`, `.council/memory/`,
   `.council/scratch/`, `.council/records/`.
4. **Write `.council/council.yaml`** from the chosen template
   (`${CLAUDE_PLUGIN_ROOT}/templates/<name>.yaml`).
5. **Copy the seats.** For each seat in the template's `seats:` list, copy
   `${CLAUDE_PLUGIN_ROOT}/personalities/<seat>.md` to `.council/seats/<seat>.md`.
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
   list, and `work_budget`. For each seat, read the frontmatter of
   `.council/seats/<seat>.md` for its `title` and `voice`.
3. **Print a table** — one row per seat, in `council.yaml` order, with the chair
   marked. Columns: seat (the `name`), title, voice. Head it with the council
   name, the chair, and the budget. For example:

   ```
   Council: software-team — chair: staff-engineer
   Budget: max_turns 12 · max_tokens 250k · scratch 200k

     Seat                Title                Voice                         Chair
     ──────────────────  ───────────────────  ────────────────────────────  ─────
     staff-engineer      Staff Engineer       rigorous, systems-thinking    ★
     security-engineer   Security Engineer    adversarial, threat-first
     qa-engineer         QA Engineer          meticulous, edge-case-hunting
     product-manager     Product Manager      user-value, scope-skeptical
   ```

   Pull `title`/`voice` straight from each seat's frontmatter; if a field is
   absent, leave it blank. Omit budget fields the council doesn't set. Keep it to
   the table plus the header — no commentary unless the user asks.

---

## Verb: meeting

A human-in-the-loop round-table. Seats speak in turn on a shared scratchpad; you
the orchestrator pause each round for the user's input; the user concludes; the
chair synthesizes. Seats are **read-only** (no worktree, no commits).

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
   b. After the round, give the user a tight summary of what each seat said and
      **ask for their input** — a steer, a constraint, a new question — or to
      conclude the meeting. Append the user's input to the scratchpad. (This is
      a normal conversational pause; wait for the user.)
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
   conformance check** before continuing. Remove the scratchpad (its content now
   lives in the record).
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
3. **Open the scratchpad** `.council/scratch/<id>.md` with the task header.
4. **Read the budget** from `council.yaml` `work_budget` (`max_turns`,
   `max_tokens`, optional wall-clock, `scratch_max_bytes`). Track turns taken, a
   rough token estimate, and the scratchpad size as you go.
5. **Chair selects seats** relevant to the task; record in the scratchpad.
6. **Take-turns loop (chair-driven):**
   a. The **chair** reads the scratchpad and decides **who acts next** and the
      concrete sub-goal for this turn.
   b. Spawn that seat as a worker with cwd in the worktree, the task, the
      sub-goal, and the scratchpad. It may read/edit files and run commands in
      the worktree. Append its turn to the scratchpad.
   c. The **chair** evaluates whether to continue. **Stop on whichever of these
      four fires first:**
      - **chair says done** — the task is genuinely complete;
      - **timeout / budget** — `max_turns`, `max_tokens`, or wall-clock exceeded;
      - **scratchpad size** — the scratchpad has grown past `scratch_max_bytes`;
      - **user stop** — the user asked to halt the run.
      Otherwise, loop.
7. **Synthesize:** spawn the chair over the full scratchpad + memory to produce
   the outcome (what was built/decided, trade-offs taken, preserved dissent).
8. **Record + memory:** write `.council/records/<id>.md` using the pinned
   **record file** structure (*Synthesis contract* below; `Mode: work`); fold
   takeaways into memory **by topic** (create/update `.council/memory/<topic>.md`
   per the pinned **memory topic** structure and **topic naming** rule). Run the
   **post-synthesis conformance check**, then remove the scratchpad.
9. **Declare done — do not auto-merge.** Leave the branch and worktree in place
   and hand the user a summary plus the exact commands to merge when *they*
   choose to, and to clean up:
   ```
   git merge --no-ff council/work-<id>
   git worktree remove .council/worktrees/<id>
   ```
   The user owns the merge decision; the chair never lands changes on the
   working tree itself.
10. **Report** the outcome, the record path, and the merge status (always
    deferred with instructions).

---

## Spawning a seat

Spawn each seat with the **Task** tool (`subagent_type: general-purpose`,
running in the background only if you are fanning out a parallel set — meeting
and work are sequential, so spawn one at a time and wait). Build the prompt as:

```
You are acting as a council seat. Fully adopt this persona — its priorities,
voice, and judgment — and respond in character.

<persona>
{contents of .council/seats/<seat>.md, body below the frontmatter}
</persona>

Council memory (durable context from past sessions):
{concatenated contents of all .council/memory/*.md topic files, or "none yet"}

Shared scratchpad (the conversation so far — read it before you speak):
{current contents of .council/scratch/<id>.md}

Task: {the user's task}
{For work turns, also: "This turn's sub-goal (assigned by the chair): ..."}
{For work, also: "Your working directory is the git worktree at
 .council/worktrees/<id>; make any file changes there."}

Respond as this seat, building on the scratchpad rather than repeating it. Be
concise and stay in your lane.
```

**Model/effort (v1):** do **not** set a per-seat model. Every seat and the chair
run on the user's current default model/effort. A seat's `model:` and `tools:`
frontmatter are documentation for now — preserve them, don't enforce them. (Per-
seat model routing for cost is a later phase.) The **chair** is spawned the same
way as any seat, but its task is to *route* (pick who's next / decide done) or to
*synthesize* (unified recommendation + dissents) rather than to give one more
opinion.

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

The six bold fields are all required and in this order. `Mode` is `meeting` or
`work`. `Concluded` uses `YYYY-MM-DD HH:MM`. Each follow-up owner is a seat name
from `council.yaml`. The trailing line cross-links every memory topic this
session wrote (one line per topic).

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

`## Decision` and `## Why` are both **required**. `## Decision` ends with a
`→ record: \`records/<id>.md\`` back-link to the session that set it.
`## Why` carries reasons, not transcript: **no `## Round N` headings and no
turn-by-turn conversation belong in memory** — that content stays in the record.

### Topic naming (deterministic)

Pick the topic file name by kebab-casing the **durable subject noun-phrase of
the decision** — not the task phrasing, not the session slug, and no dates.
("Should we adopt a job queue?" → `job-queue`; a decision about how the council
tests → `testing-standards`.) Before creating one, **list the existing
`memory/*.md` files and reuse the file if the subject already has one**;
otherwise create a new file. Updating an existing topic keeps its history and
adds the new decision rather than spawning a near-duplicate file.

### Post-synthesis conformance check

Two hard gates. **Both MUST pass before you remove the scratchpad** — these catch
the silent failures a skim would miss:

1. **Dissents preserved, not flattened.** The record has a literal
   `## Dissents (preserved)` section, and every dissent recorded in the
   scratchpad survives there in its seat's own voice — not summarized away into
   the recommendation. (If there were genuinely no dissents, the section says so
   explicitly rather than being dropped.)
2. **Cross-link closure (bidirectional).** The record's `→ memory updated:` line
   names every topic file written, **and** each of those topic files'
   `## Decision` carries a `→ record:` back-link to this record. Both directions
   must close.

The templates above already pin the rest — field order, prose H1, the `Concluded`
`YYYY-MM-DD HH:MM` format, the section names, kebab topic naming, no transcript in
memory. Follow the templates; don't re-grade each formatting detail as its own
checkbox.
