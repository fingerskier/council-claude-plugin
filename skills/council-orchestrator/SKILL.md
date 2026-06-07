---
name: council-orchestrator
description: Orchestrates a council of personality "seats" for the /council command. Use when the user runs /council, or asks to convene a council, hold a council meeting, or have the council work on a task. Handles the convene, meeting, and work verbs — reading .council/, spawning seat workers, driving the shared scratchpad, and having the chair synthesize.
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
  ├── memory/memory.md    # long-term council memory, carried across sessions
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
6. **Seed memory** if absent: create `.council/memory/memory.md` with a short
   header (council name + convened date).
7. **Write `.council/.gitignore`** so ephemeral state isn't committed:
   ```
   scratch/
   worktrees/
   ```
8. **Report**: the council name, chair, and roster, and tell the user the files
   under `.council/seats/` and `.council/council.yaml` are theirs to edit
   (tweak a voice, add/remove a seat, change the chair or budget).

---

## Verb: meeting

A human-in-the-loop round-table. Seats speak in turn on a shared scratchpad; you
the orchestrator pause each round for the user's input; the user concludes; the
chair synthesizes. Seats are **read-only** (no worktree, no commits).

1. **Session id:** `<YYYYMMDD-HHMMSS>-<short-slug-of-task>`.
2. **Open the scratchpad** `.council/scratch/<id>.md` with a header: the task,
   the date, the chair, and the roster.
3. **Chair selects seats.** Have the chair pick the seats relevant to this task
   (often all of them). Record the selection in the scratchpad.
4. **Round loop:**
   a. For each selected seat **in turn**, spawn a seat worker (see *Spawning a
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
6. **Record:** write the synthesis to `.council/records/<id>.md`. Append durable
   takeaways to `.council/memory/memory.md`. Remove the scratchpad (its content
   now lives in the record).
7. **Report** the synthesis to the user and point at the record file.

---

## Verb: work

Autonomous take-turns until done. The chair selects seats and drives the loop
with **no user input**; seats work in a **git worktree**; on completion the
chair synthesizes, records, and merges-or-defers. This verb scales: a quick
question resolves in a turn or two; a bounded implementation grinds for many.

1. **Session id:** as above.
2. **Set up the worktree** (if this is a git repo):
   ```
   git worktree add -b council/work-<id> .council/worktrees/<id> HEAD
   ```
   Seats do their file work with this directory as cwd. (If not a git repo, work
   in place and note that isolation is unavailable.)
3. **Open the scratchpad** `.council/scratch/<id>.md` with the task header.
4. **Read the budget** from `council.yaml` `work_budget` (`max_turns`,
   `max_tokens`, optional wall-clock). Track turns taken and a rough token
   estimate as you go.
5. **Chair selects seats** relevant to the task; record in the scratchpad.
6. **Take-turns loop (chair-driven):**
   a. The **chair** reads the scratchpad and decides **who acts next** and the
      concrete sub-goal for this turn.
   b. Spawn that seat as a worker with cwd in the worktree, the task, the
      sub-goal, and the scratchpad. It may read/edit files and run commands in
      the worktree. Append its turn to the scratchpad.
   c. The **chair** evaluates: is the task genuinely complete? Has a budget
      limit been hit? If neither, loop. **Stop** on chair-judged completion or
      budget exhaustion — whichever first.
7. **Synthesize:** spawn the chair over the full scratchpad + memory to produce
   the outcome (what was built/decided, trade-offs taken, preserved dissent).
8. **Record + memory:** write `.council/records/<id>.md`; append takeaways to
   `.council/memory/memory.md`; remove the scratchpad.
9. **Merge or defer the worktree:**
   - **Clean and the chair is confident** → merge back and clean up:
     ```
     git merge --no-ff council/work-<id>
     git worktree remove .council/worktrees/<id>
     ```
     (Resolve trivial conflicts; if the merge is non-trivial, fall through to
     defer.)
   - **Conflicted, risky, or ambiguous** → **defer to the user**: leave the
     branch and worktree in place and hand over a summary plus the exact
     commands to merge (`git merge --no-ff council/work-<id>`) and to clean up
     (`git worktree remove .council/worktrees/<id>`).
10. **Report** the outcome, the record path, and the merge status (merged, or
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
{contents of .council/memory/memory.md, or "none yet"}

Shared scratchpad (the conversation so far — read it before you speak):
{current contents of .council/scratch/<id>.md}

Task: {the user's task}
{For work turns, also: "This turn's sub-goal (assigned by the chair): ..."}
{For work, also: "Your working directory is the git worktree at
 .council/worktrees/<id>; make any file changes there."}

Respond as this seat, building on the scratchpad rather than repeating it. Be
concise and stay in your lane.
```

Honor each seat's frontmatter where you can: prefer the seat's `model` (run
cheap voices on `sonnet`, the chair on `opus`), and respect a seat's `tools`
restriction. The **chair** is spawned the same way, but its task is to *route*
(pick who's next / decide done) or to *synthesize* (unified recommendation +
dissents) rather than to give one more opinion.

## Synthesis contract (the chair's output)

Whenever the chair synthesizes, produce:

1. a **unified recommendation / outcome** — the single headline answer;
2. **dissents** — where seats disagreed and why, preserved not flattened;
3. (for the record file) the **reasoning trail** so the deliberation is
   auditable.

A synthesis that erases disagreement is just one opinion in a trench coat —
keep the strongest dissent visible.
