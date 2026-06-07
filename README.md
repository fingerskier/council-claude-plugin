# council

A Claude Code plugin that convenes a **council** of named **seats**
(personalities) and puts them to work — an interactive **meeting** or an
autonomous **work** session — while a **chair** routes the seats and synthesizes
a single answer.

See [PLAN.md](./PLAN.md) for the full design.

## Commands

```
/council convene [template]    # create/recreate .council/ from a template; then edit the files
/council meeting "<task>"      # human-in-the-loop round-table; you conclude; chair synthesizes
/council work "<task>"         # autonomous take-turns in a worktree until the chair calls it done
```

- **`convene`** stamps a template into a per-project `.council/` directory. From
  then on the council is local, editable files you own — tweak a seat's voice,
  add or drop a seat, retune the chair or the work budget.
- **`meeting`** keeps you in the loop: seats speak in turn on a shared
  scratchpad, you steer each round, and when you conclude the chair synthesizes
  the conversation into `.council/records/`.
- **`work`** takes you out of the loop: the chair picks who acts each turn and
  the seats take turns in a git worktree until the chair calls it done (or the
  budget is spent), then synthesizes, records, and merges back or defers the
  merge to you.

## Layout

```
.claude-plugin/plugin.json
commands/council.md                  # slash-command entry
skills/council-orchestrator/SKILL.md # the orchestrator: routing, protocols, synthesis
personalities/*.md                   # the seat library (extensible)
templates/*.yaml                     # presets: c-suite, engineering-team, writing-lab, hedge-fund-team
```

The council it creates lives under `.council/` in your working repo:

```
.council/
├── council.yaml      # active council: seats, chair, work budget
├── seats/*.md        # editable copies of the seat personalities
├── memory/memory.md  # long-term council memory
├── scratch/          # ephemeral shared scratchpads (gitignored)
├── records/          # durable synthesized outputs
└── worktrees/        # git worktrees for work sessions (gitignored)
```

## Adding a seat

Drop a markdown file in `personalities/` (or `.council/seats/` for one council)
with the persona as the body:

```markdown
---
name: historian
title: Historian
model: sonnet
voice: context-seeking, precedent-aware
tools: [read, web_search]
---
You are the Historian on this council. Surface the relevant precedent...
```

Then add `historian` to a template's `seats:` list, or to
`.council/council.yaml`. No code change required.

## Status

Early. The plugin scaffolding, orchestrator skill, seat library, and templates
are in place; see PLAN.md §9 for phasing.
