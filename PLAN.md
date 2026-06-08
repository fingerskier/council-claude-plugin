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
│   ├── engineering-manager.md  mechanical-engineer.md  electrical-engineer.md
│   ├── firmware-engineer.md  application-engineer.md  infrastructure-engineer.md
│   ├── founder-operator.md  customer-advocate.md  growth-marketer.md  legal-risk-advisor.md
│   └── editor.md  line-editor.md  critic.md  researcher.md
├── templates/                           # preset compositions
│   ├── software-team.yaml
│   ├── product-engineering-team.yaml
│   ├── c-suite.yaml
│   ├── solo-founder.yaml
│   └── writing-lab.yaml
├── examples/                            # reference snapshot of a convened .council/
│   └── sample-council/                  # docs only — pins the on-disk formats
└── README.md
```

### `.council/` layout (the convened council)

```
.council/
├── council.yaml          # active council: seats, chair, model routing, defaults
├── seats/                # editable copies of the seat personalities
│   ├── ceo.md  cfo.md  ...
├── memory/               # persistent council memory: one MD file per topic
│   ├── <topic>.md
│   └── <topic>.md
├── scratch/              # live shared scratchpads for meeting/work (ephemeral)
│   └── <session-id>.md
└── records/              # synthesized, durable outputs
    └── <timestamp>-<slug>.md   # == the session id; record filename is the session id
```

`.council/scratch/` is working memory for a single session; `.council/records/` is the permanent file the chair writes when a meeting or work session concludes. `.council/memory/` is the council's long-term context, readable by seats on later invocations — **one markdown file per topic** (not a single log). When a meeting or work session concludes, the chair creates or updates the relevant topic file with the decision and its *why*. A worked example of all three lives in `examples/sample-council/`.

## 3. Personality file format

**Every seat is one persona file** — in the plugin's `personalities/` library, and (once convened) as an editable copy at `.council/seats/<name>.md`. The **filename matches the seat's `name`**, which is exactly the name listed in `council.yaml` (`council.yaml` says `qa-engineer` → the file is `.council/seats/qa-engineer.md`). The frontmatter is metadata; the **body *is* that seat's system prompt**, injected verbatim when the seat is spawned. This is the customization surface: to retune a voice, add a seat, or drop one, the user just edits these files — no code change.

Frontmatter mirrors the subagent schema so a seat maps cleanly onto a spawned worker (and, in headless mode, straight into an `--agents` JSON entry).

```markdown
---
name: cfo                # must match the filename and the council.yaml entry
title: Chief Financial Officer
voice: skeptical, numbers-driven, risk-averse
model: sonnet            # v1: documentation only — not enforced (see §3 note, §8)
tools: [read, web_search]   # v1: documentation only — not enforced
---
You are the CFO on this council. Evaluate every proposal through capital
efficiency, runway, and downside risk. Quantify where possible. Name the
assumption that would have to be true for this to pay off. Be terse.
```

Convention: keep the body a *persona*, not a task. The task is injected at runtime. Once convened, these live in `.council/seats/` and the user edits them freely.

> **v1 model/effort policy.** The orchestrator does **not** manage per-seat models or effort in the first version — every seat (and the chair) runs on the user's current default model/effort. The `model:` and `tools:` fields are accepted and preserved as forward-looking documentation but are *not* enforced yet. Per-seat model routing for cost is **declined** — the user cut it in Phase 4, so no phase currently enforces it (see §8, §9 Phase 4). This keeps the orchestrator simple and avoids fighting the user's session settings.

## 4. Council templates (the "shape")

A template names the seats, the chair (synthesizer), and default budgets. These are the prebuilts — software team, product engineering team, C-suite, solo founder, writing lab, hedge-fund team — and users can add their own to the library or just edit `.council/council.yaml` after convening.

```yaml
# templates/software-team.yaml  ->  becomes .council/council.yaml on convene
name: software-team
description: Software design + review council
chair: staff-engineer
seats: [staff-engineer, security-engineer, qa-engineer, product-manager]
work_budget:
  max_turns: 12          # hard cap on take-turns rounds in `work`
  scratch_max_bytes: 200000  # hard stop trigger: halt `work` if the scratchpad grows past this
```

## 5. The commands

The surface is four verbs. `convene` sets up; `info` reports the roster; `meeting` and `work` put the council to work — the difference between the last two is whether you stay in the loop.

```
/council convene [template]    # create/recreate .council/ from a template; then edit the files
/council info                  # show a concise table of the convened council's seats
/council meeting "<task>"      # human-in-the-loop round-table; you conclude; chair synthesizes
/council work "<task>"         # autonomous take-turns in a worktree until the chair calls it done
```

### `/council convene [template]`

Stamps a template into `.council/`. Idempotent: re-running **recreates** the council from the template. Steps:

1. Pick the template (arg, or prompt from the library; default `software-team`).
2. Create `.council/`, write `council.yaml`, copy each seat's personality into `.council/seats/`, scaffold empty `memory/`, `scratch/`, `records/`.
3. If `.council/` already exists, confirm before overwriting (so hand-edits aren't lost without consent), or merge non-destructively.
4. Tell the user the files are theirs to tweak.

No task runs. This is pure setup — the council only does work via the other verbs.

### `/council info`

Read-only introspection of the convened council — no session, no spawn. The orchestrator reads `.council/council.yaml` and each `.council/seats/<seat>.md` frontmatter and prints a concise table so the user can see who's at the table at a glance:

```
Council: software-team — chair: staff-engineer
Budget: max_turns 12 · scratch 200k

  Seat                Title                       Voice                        Chair
  ──────────────────  ──────────────────────────  ───────────────────────────  ─────
  staff-engineer      Staff Engineer              pragmatic, systems-level      ★
  security-engineer   Security Engineer           adversarial, threat-first
  qa-engineer         QA Engineer                 test-first, edge-case hunter
  product-manager     Product Manager             user-value, scope-skeptical
```

Columns come straight from each seat's frontmatter (`name`, `title`, `voice`), with the chair marked. If `.council/` doesn't exist, it tells the user to `convene` first. Purely informational; it never spawns a worker.

### `/council meeting "<task>"`

The deliberative, **human-in-the-loop** round-table. **All convened seats speak** — there is no seat selection in `meeting` (decision #2); the whole table is the point. They speak **sequentially**, each one seeing everything said so far via a **shared scratchpad** (`.council/scratch/<id>.md`).

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
- Stops on **any** of five triggers (decision #3): **the chair says done**, a **budget exceeded** (`max_turns`, the hard turn-count cap from `council.yaml` — there is no token cap, since the orchestrator can't reliably count tokens), the **scratchpad grows past its size limit** (`scratch_max_bytes`), the **wall-clock budget is reached** (`max_wall_seconds`, optional and armed only when set `> 0` — checked at turn boundaries against a `date +%s` epoch recorded at session open), or the **user asks it to stop**.
- On finish, the chair **synthesizes** the outcome and **records** it to `.council/records/`. The chair does **not** auto-merge: it **declares the work done and leaves the worktree branch in place**; the **user asks for the merge** when they're ready (decision #4). The chair hands over the exact merge/cleanup commands.

- Use for: anything from a quick breadth scan to a bounded implementation/refactor/research task you want the council to grind on unattended.

### Shared mechanics

- **Scratchpad:** `meeting` and `work` both use `.council/scratch/<session-id>.md` as the shared, append-only conversation seats read before speaking. Deleted or archived to `records/` at session end.
- **Memory:** both may read `.council/memory/` for council context, and append durable takeaways on conclusion.
- **Records:** both write a synthesis to `.council/records/` when the session concludes.

## 6. Isolation and the worktree

`work` performs filesystem mutations, so it runs in a **dedicated git worktree** rather than the user's working tree. The seats edit there; the scratchpad and records still live in the main `.council/`. When the chair calls the task done (decision #4 — **the chair never auto-merges**):

- The chair **declares the work complete**, leaves the branch and worktree in place, and reports a summary of what changed and why.
- The **user decides when to merge** and asks for it; the chair hands over the exact commands (`git merge --no-ff council/work-<id>`, then `git worktree remove .council/worktrees/<id>`). This keeps the human in control of what lands on their working tree.

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
- **Model/effort (v1):** seats and the chair all run on the **user's current default model/effort** — the orchestrator does not set per-seat models in the first version (see §3). Per-seat model routing is **declined** (the user cut it in Phase 4); the `model:`/`tools:` fields are preserved purely as forward-looking documentation and no phase currently enforces them. A long `work` run can still burn far more tokens than a normal session — `work_budget` in `council.yaml` is the explicit guardrail: `max_turns` and `scratch_max_bytes` are the hard stops (turn count and byte size are measured exactly). There is deliberately **no token cap**: the orchestrator has no reliable per-turn token count, so a token budget couldn't fire — `max_turns` bounds run length, and token spend rides along with it.

## 9. MVP and phasing

**Phase 0 — scaffolding & decisions** *(this phase)*
- worked example of a convened council under `examples/sample-council/` pinning the memory / scratch / record formats
- `/council info` specified (read-only roster table)
- v1 model/effort policy fixed: use the user's default, no per-seat routing
- open decisions §10 resolved (#1–#5)

**Phase 1 — convene & info**
- `plugin.json`, orchestrator skill, personality format, templates
- `/council convene` writing `.council/` (council.yaml + seats/ + dirs), confirm-then-overwrite on an existing council (#1)
- `/council info` reading the convened roster into a table
- the six prebuilt templates + the personality library

**Phase 2 — meeting**
- shared scratchpad under `.council/scratch/`
- **all seats** speak each round (no seat selection, #2) + per-round user input
- chair synthesis → `.council/records/` + per-topic `.council/memory/*.md` write (#5)

**Phase 3 — work**
- autonomous take-turns with chair routing + termination
- worktree isolation, budget guardrails (`max_turns`/`scratch_max_bytes`)
- four stop triggers — chair-done / budget / scratch-size / user-stop (#3) (Phase 4 adds the fifth, `max_wall_seconds`; see below)
- chair declares done and hands off; **user asks for the merge** (#4); record + per-topic memory write-back

**Phase 4 — polish**
- `.council/memory/` read-back across sessions — **delivered** (memory is injected into every seat and the chair at spawn; Phase 4 pins the concatenation order so read-back is deterministic).
- `max_wall_seconds` wall-clock/timeout budget — **delivered** (a fifth, optional `work` stop trigger; armed only when set `> 0`; measured at turn boundaries against a `date +%s` epoch recorded at session open; absent/0/negative = unarmed).
- ~~per-seat model routing (re-enables the `model:` field deferred in v1)~~ — **declined:** no per-seat routing; v1 default-model policy stands.
- ~~recreate-safety for `convene` (non-destructive merge of hand-edits)~~ — **deferred:** confirm-then-overwrite (decision #1) is sufficient until a user loses hand-edits in practice.

## 10. Resolved decisions

1. **`convene` recreate semantics → confirm-then-overwrite.** On an existing `.council/`, warn and require a yes, then recreate from the template. Non-destructive three-way merge of hand-edits is deferred to Phase 4.
2. **Seat selection → no selection in `meeting`.** `meeting` always runs **all** convened seats (the whole table is the point). `work` keeps chair-selects-the-relevant-subset, since an autonomous run shouldn't pay for irrelevant voices.
3. **`work` stop triggers → any of five.** The run stops on whichever comes first: **chair says done**, **budget exceeded** (`max_turns`), **scratchpad size limit** (`scratch_max_bytes`), **wall-clock** (`max_wall_seconds`, optional — armed only when set `> 0`, checked at turn boundaries), or **user requests stop**.
4. **Worktree merge → chair declares done, user asks for merge.** No auto-merge. The chair finishes, leaves the branch/worktree in place, and the user merges when ready (the chair hands over the commands).
5. **Memory → one MD file per topic.** Not an append-only log. After a meeting or work session, the chair creates or updates the appropriately named topic file under `.council/memory/`. (Structured/queryable memory remains a possible later evolution.)

---

*This maps onto a moderator/worker topology: the chair is the moderator/router, the seats are workers, the personality library is the cast, and `.council/` is the council's office — where it keeps its roster, its notes, and its minutes.*
