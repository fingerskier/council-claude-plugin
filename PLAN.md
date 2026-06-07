# Council — Plugin Plan

A Claude Code plugin that turns the CLI into a multi-perspective deliberation engine. You **convene** a council of named **seats** (personalities) into a project, then hand it either an interactive **meeting** or an autonomous **work** session — while a **chair** routes the seats and synthesizes a single answer.

## 1. Core idea

Personalities are *data*, not registered agents. The plugin ships:

- **one orchestrator** (a skill + a slash command),
- a **library of personality files** (markdown), and
- **council templates** (named compositions of seats).

`convene` stamps a chosen template into a per-project **`.council/`** directory. From then on the council is local, editable files the user owns — tweak a seat's voice, add a seat, drop one, retune the chair. At invocation the orchestrator reads `.council/`, spawns a worker per selected seat, runs the chosen protocol, and folds results back through the chair.

The surface is intentionally tiny: **`convene`** sets the council up, and the two work verbs differ only on whether *you* are in the loop. **`meeting`** keeps you in it (you steer each round and call the end); **`work`** takes you out of it (the chair drives until done). Everything else — picking which seats speak, sequencing turns, synthesizing — is the chair's job in both.

The roster is always `count(seats in .council/)` — fully dynamic, nothing pre-registered. Adding `.council/seats/historian.md` makes it available with zero code change. This sidesteps the fixed-roster limit: registered plugin subagents are a static set, but *spawned* workers carrying a personality prompt are not. The personality is just a string the orchestrator injects at spawn time. (It also dodges the plugin-subagent restriction banning `hooks`/`mcpServers`/`permissionMode` frontmatter, since these workers aren't registered plugin subagents.)

## 2. Two locations: the library vs. the convened council

| | Ships with the plugin (read-only) | Lives in the project (user-owned) |
|---|---|---|
| **Where** | `council/` plugin dir | `.council/` in the working repo |
| **What** | personality library + templates | the active council, its memory, its records |
| **When** | installed once | created/recreated by `/council convene` |

Everything the council *is* and everything it *remembers* lives under `.council/`. The plugin is just the source material `convene` copies from.

### Plugin structure (the library)

```
council/
├── .claude-plugin/plugin.json
├── skills/
│   └── council-orchestrator/SKILL.md   # the brain: routing, protocols, synthesis
├── commands/
│   └── council.md                       # slash-command entry, delegates to skill
├── personalities/                       # the seat library (extensible)
│   ├── ceo.md  cfo.md  cto.md  coo.md  chief-counsel.md
│   ├── staff-engineer.md  security-engineer.md  qa-engineer.md  product-manager.md
│   └── editor.md  line-editor.md  critic.md  researcher.md
├── templates/                           # preset compositions
│   ├── c-suite.yaml
│   ├── engineering-team.yaml
│   └── writing-lab.yaml
└── README.md
```

### `.council/` layout (the convened council)

```
.council/
├── council.yaml          # active council: seats, chair, model routing, defaults
├── seats/                # editable copies of the seat personalities
│   ├── ceo.md  cfo.md  ...
├── memory/               # persistent council memory, carried across sessions
│   └── memory.md
├── scratch/              # live shared scratchpads for meeting/work (ephemeral)
│   └── <session-id>.md
└── records/              # synthesized, durable outputs
    └── <timestamp>-<slug>.md
```

`.council/scratch/` is working memory for a single session; `.council/records/` is the permanent file the chair writes when a meeting or work session concludes. `.council/memory/` is the council's long-term context, readable by seats on later invocations.

## 3. Personality file format

Frontmatter mirrors the subagent schema so a seat maps cleanly onto a spawned worker (and, in headless mode, straight into an `--agents` JSON entry). The body *is* the system prompt.

```markdown
---
name: cfo
title: Chief Financial Officer
model: sonnet            # cheap voices on cheaper models; chair on opus
voice: skeptical, numbers-driven, risk-averse
tools: [read, web_search]   # optional per-seat tool restriction
---
You are the CFO on this council. Evaluate every proposal through capital
efficiency, runway, and downside risk. Quantify where possible. Name the
assumption that would have to be true for this to pay off. Be terse.
```

Convention: keep the body a *persona*, not a task. The task is injected at runtime. Once convened, these live in `.council/seats/` and the user edits them freely.

## 4. Council templates (the "shape")

A template names the seats, the chair (synthesizer), and default budgets. These are the prebuilts — C-suite, engineering team, writing lab, hedge-fund team — and users can add their own to the library or just edit `.council/council.yaml` after convening.

```yaml
# templates/engineering-team.yaml  ->  becomes .council/council.yaml on convene
name: engineering-team
description: Technical design + review council
chair: staff-engineer
seats: [staff-engineer, security-engineer, qa-engineer, product-manager]
work_budget:
  max_turns: 12          # cap on take-turns rounds in `work`
  max_tokens: 250000     # soft ceiling; chair wraps up when exceeded
```

## 5. The three commands

The surface is three verbs. `convene` sets up; `meeting` and `work` put the council to work — the difference is whether you stay in the loop.

```
/council convene [template]    # create/recreate .council/ from a template; then edit the files
/council meeting "<task>"      # human-in-the-loop round-table; you conclude; chair synthesizes
/council work "<task>"         # autonomous take-turns in a worktree until the chair calls it done
```

### `/council convene [template]`

Stamps a template into `.council/`. Idempotent: re-running **recreates** the council from the template. Steps:

1. Pick the template (arg, or prompt from the library; default `engineering-team`).
2. Create `.council/`, write `council.yaml`, copy each seat's personality into `.council/seats/`, scaffold empty `memory/`, `scratch/`, `records/`.
3. If `.council/` already exists, confirm before overwriting (so hand-edits aren't lost without consent), or merge non-destructively.
4. Tell the user the files are theirs to tweak.

No task runs. This is pure setup — the council only does work via the other two verbs.

### `/council meeting "<task>"`

The deliberative, **human-in-the-loop** round-table. Seats speak **sequentially**, each one seeing everything said so far via a **shared scratchpad** (`.council/scratch/<id>.md`).

Loop per round:
1. Each seat speaks in turn, appending to the scratchpad; later seats react to earlier ones.
2. At the end of the round, **the user may add input** — a steer, a constraint, a new question — which goes into the scratchpad for the next round.
3. Repeat until **the user concludes the meeting**.

On conclusion, the **chair synthesizes** the whole conversation (decision + dissents + open threads) and writes it to `.council/records/<timestamp>-<slug>.md`. Salient takeaways may be appended to `.council/memory/`.

- Use for: contested calls, design debates, anything where your judgment belongs in the loop.

### `/council work "<task>"`

The **autonomous** mode, and the council's only work verb that runs unattended. The chair **selects the relevant seats** for the task (not necessarily all), then they **take turns** — **the chair decides who goes next** each turn — with **no user input** during the run. They share the same scratchpad mechanism as `meeting` (`.council/scratch/<id>.md`) so each turn builds on the last.

This scales: a quick gut-check resolves in a turn or two and reads like a fast multi-perspective answer; a bounded implementation grinds across many turns. Same verb, the chair just runs the loop as long as the task warrants.

- Runs in a **git worktree** (see §6) so filesystem changes are isolated.
- Continues until the **chair judges the task complete**, or a **budget is exceeded** (`max_turns` / `max_tokens` / wall-clock from `council.yaml`).
- On finish, the chair **synthesizes** the outcome, **records** it to `.council/records/`, and **either merges the worktree back or defers to the user** for the merge decision.

- Use for: anything from a quick breadth scan to a bounded implementation/refactor/research task you want the council to grind on unattended.

### Shared mechanics

- **Scratchpad:** `meeting` and `work` both use `.council/scratch/<session-id>.md` as the shared, append-only conversation seats read before speaking. Deleted or archived to `records/` at session end.
- **Memory:** both may read `.council/memory/` for council context, and append durable takeaways on conclusion.
- **Records:** both write a synthesis to `.council/records/` when the session concludes.

## 6. Isolation and the worktree

`work` performs filesystem mutations, so it runs in a **dedicated git worktree** rather than the user's working tree. The seats edit there; the scratchpad and records still live in the main `.council/`. When the chair calls the task done:

- **Clean and confident →** chair merges the worktree branch back and reports.
- **Conflicted, risky, or ambiguous →** chair **defers to the user**: leaves the branch/worktree in place and hands over the merge with a summary of what changed and why.

`meeting` defaults to **read-only** seats (no worktree) — it produces opinions and prose, not commits. A `meeting` that decides on changes typically hands off to a `work` session, which is where filesystem mutation happens.

## 7. Output synthesis

The chair receives the task plus the seats' contributions (the full scratchpad for both `meeting` and `work`) and produces:

1. a **unified recommendation / outcome** (the headline),
2. **dissents** — where seats disagreed and why, preserved not flattened,
3. a **record artifact** under `.council/records/` with the reasoning trail, so the deliberation is auditable.

Dissent preservation is the point of a council — a synthesis that erases disagreement is just one opinion in a trench coat.

## 8. Technical approach

- **Interactive (primary):** the orchestrator skill drives Task-tool subagents, building each worker's prompt from `.council/seats/<seat>.md` + injected task + the shared scratchpad. Sequential turn-taking for both `meeting` and `work`.
- **Chair as router:** the chair selects which seats are relevant, picks who acts each turn, and decides termination (in `work`) or synthesizes on the user's call (in `meeting`). The chair is itself a seat (a personality file), so its routing/synthesis voice is tunable.
- **Headless/SDK:** emit an `--agents` JSON object keyed by seat name, each personality body as the `prompt`. Same files, two delivery paths.
- **Model routing for cost:** run voices on a cheaper model, reserve the strong model for the chair. A long `work` run can burn far more tokens than a normal session — `work_budget` in `council.yaml` is the explicit guardrail, and `work` honors it as a hard stop.

## 9. MVP and phasing

**Phase 1 — convene**
- `plugin.json`, orchestrator skill, personality format, templates
- `/council convene` writing `.council/` (council.yaml + seats/ + dirs)
- the four prebuilt templates + the personality library

**Phase 2 — meeting**
- shared scratchpad under `.council/scratch/`
- chair seat selection + sequential round-table with per-round user input
- chair synthesis → `.council/records/`

**Phase 3 — work**
- autonomous take-turns with chair routing + termination
- worktree isolation, budget guardrails (`max_turns`/`max_tokens`/wall-clock)
- chair merge-or-defer; record + memory write-back

**Phase 4 — polish**
- `.council/memory/` read-back across sessions
- per-seat model routing refinements
- recreate-safety for `convene` (non-destructive merge of hand-edits)

## 10. Open decisions (need your call)

1. **`convene` recreate semantics.** On an existing `.council/`, hard-overwrite-with-confirm, or three-way merge that preserves hand-edited seats? Plan assumes confirm-then-overwrite for MVP, non-destructive merge later.
2. **Seat selection.** Chair picks the relevant subset, or default to *all* seats unless you name some? Plan assumes chair-selects in both `meeting` and `work`.
3. **`work` termination authority.** Chair-decides-done as the only stop besides budget, or also a hard turn cap independent of the chair's judgment? Plan uses chair-decides plus budget ceiling.
4. **Worktree merge default.** Should a clean `work` run auto-merge, or always defer the merge to the user? Plan auto-merges when clean, defers when not.
5. **Memory growth.** Append-only `memory.md`, or structured/queryable memory the seats can search? Plan starts append-only.

---

*This maps onto a moderator/worker topology: the chair is the moderator/router, the seats are workers, the personality library is the cast, and `.council/` is the council's office — where it keeps its roster, its notes, and its minutes.*
