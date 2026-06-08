# council

**A single agent doesn't disagree with itself.** Ask one for a verdict and you get one perspective, confidently — no security engineer poking at the trust boundary, no QA hunting the edge case, no PM asking whether you're solving the right problem. `council` fixes that: it convenes a roster of opinionated **seats**, each a distinct persona, has them deliberate, and lets a **chair** synthesize one answer — while **preserving the dissent** in an auditable record instead of flattening it into false consensus.

Use it when a decision is worth more than one opinion: a design review, a "should we ship this?" gut-check, an autonomous task you want pressure-tested as it's built.

A Claude Code plugin that convenes a **council** of named **seats**, each with a unique personality, and puts them to work in an interactive **meeting** or an autonomous **work** session. The **chair** routes the others and synthesizes a single answer, keeping any dissent on the record.

See [PLAN.md](./PLAN.md) for the full design.

## Install

This is a standard Claude Code plugin — `commands/` and `skills/` are discovered
by convention, no build step.

```bash
# Try it locally from a clone (no install):
git clone https://github.com/fingerskier/council-claude-plugin
claude --plugin-dir council-claude-plugin
```

Then, in any repo:

```
/council convene          # stamp a .council/ from the default software-team template
/council meeting "should we adopt a job queue?"
```

To install it permanently, add the plugin via Claude Code's plugin/marketplace
configuration pointing at this repo
(`https://github.com/fingerskier/council-claude-plugin`).

## Commands

```
/council convene [template]    # create/recreate .council/ from a template; then edit the files
/council info                  # print a concise table of the convened council's seats
/council meeting "<task>"      # human-in-the-loop round-table; you conclude; chair synthesizes
/council work "<task>"         # autonomous take-turns in a worktree until the chair calls it done
```

- **`convene`** stamps a template into a per-project `.council/` directory. From
  then on the council is local, editable files you own — tweak a seat's voice,
  add or drop a seat, retune the chair or the work budget.
- **`info`** prints the convened roster — seat, title, voice, with the chair
  marked — straight from the files. Read-only; it runs nothing.
- **`meeting`** keeps you in the loop: seats speak in turn on a shared
  scratchpad, you steer each round, and when you conclude the chair synthesizes
  the conversation into `.council/records/`.
- **`work`** takes you out of the loop: the chair picks who acts each turn and
  the seats take turns in a git worktree until the chair calls it done (or the
  budget/scratch limit is hit, or you stop it), then synthesizes and records.
  The chair never auto-merges — it hands you the worktree and the merge commands
  to run when you're ready.

## Layout

```
.claude-plugin/plugin.json
commands/council.md                  # slash-command entry
skills/council-orchestrator/SKILL.md # the orchestrator: routing, protocols, synthesis
personalities/*.md                   # the seat library (extensible)
templates/*.yaml                     # presets: software-team, product-engineering-team, c-suite, solo-founder, writing-lab, hedge-fund-team
```

The council it creates lives under `.council/` in your working repo:

```
.council/
├── council.yaml      # active council: seats, chair, work budget
├── seats/*.md        # editable copies of the seat personalities
├── memory/*.md       # long-term council memory, one file per topic
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

## Trust model

The seat and memory files are **prompt material, not sandboxed input**. The
orchestrator injects the contents of `.council/seats/*.md` and
`.council/memory/*.md` verbatim into each subagent's prompt, and a `work`
subagent then runs `bash` and edits files inside its worktree. Treat those files
as **trusted code you would run yourself** — only adopt seat or memory content
from a source you trust. The worktree keeps `work` edits scoped by convention,
but it is a soft guardrail enforced in the prompt, **not a security boundary**.

> **Shell note:** the `work` session's helpers (`date +%s`, `mkdir -p`,
> `git worktree`) assume a POSIX shell. They run in Claude Code's bundled Bash
> tool, not your native shell, so this works on Windows too — but a council
> driven through a raw PowerShell session without Bash would silently fail to
> populate the wall-clock timer.

## Status

All four verbs — `convene`, `info`, `meeting`, `work` — are implemented and
dogfooded (this repo runs its own council; see [.council/](./.council/) for real
records and memory). Worktree isolation, the five `work` stop triggers, and the
two-tier memory manifest are in place. Per-seat model routing is **declined** and
the `convene` recreate-merge is **deferred**; see PLAN.md §9 for the full
phasing and dispositions.
