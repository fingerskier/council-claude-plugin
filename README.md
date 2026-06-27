# council

A [Claude Code](https://code.claude.com/docs/en/overview) plugin that convenes a
**council** of named **seats**, each with a unique personality, and puts them to
work in an interactive **meeting** or an autonomous **work** session. The
**chair** routes the others and synthesizes a single answer, keeping any dissent
on the record.

## Getting started

You don't need to be a programmer to run a council — just to paste a few
commands into a terminal. Three steps: get Claude Code, get this plugin,
convene your first council.

### 1. Get Claude Code

`council` runs inside **Claude Code**, Anthropic's AI assistant that lives in
your terminal. You'll need a [Claude](https://claude.ai) account (Pro or Max) or
an Anthropic API key to sign in.

Open a terminal (macOS: the **Terminal** app; Windows: **PowerShell**) and paste
the installer line for your system:

**macOS / Linux:**

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://claude.ai/install.ps1 | iex
```

Then run `claude` once — the first run walks you through signing in. If
anything snags, the official [setup guide](https://code.claude.com/docs/en/setup)
has the full instructions.

### 2. Install the plugin

Start Claude Code anywhere (just run `claude` in a terminal) and paste these two
commands at its prompt:

```
/plugin marketplace add fingerskier/claude-plugins
/plugin install council@fingerskier-plugins
```

The first command registers the [fingerskier/claude-plugins](https://github.com/fingerskier/claude-plugins)
marketplace as a plugin source; the second installs the `council` plugin from
it. That's the whole install — there is no build
step, and `/council` is now available in every Claude Code session.

**Prefer to try it without installing?** Clone the repo and load it for a
single session instead:

```bash
git clone https://github.com/fingerskier/council-claude-plugin
claude --plugin-dir council-claude-plugin
```

### 3. Set up your first council

Each council lives in its own folder: its roster, its memory, and its meeting
records all stay together there. So make **one sub-directory per council** — a
folder for your product council, another for your writing council, and so on —
then start Claude Code inside it:

```bash
mkdir product-council
cd product-council
claude
```

(If you took the try-it-without-installing path in step 2, start Claude Code
with `claude --plugin-dir ../council-claude-plugin` instead, adjusting the path
to wherever you cloned it.)

Inside Claude Code, convene the council:

```
/council convene
```

It will ask which template to use — `software-team` is the default;
`c-suite`, `product-engineering-team`, `solo-founder`, `writing-lab`,
`hedge-fund-team`, and `research-lab` are also bundled. Convening stamps a
`.council/` directory into your folder with editable seat files — the council is
now yours to tune.

Check the roster and hold your first meeting:

```
/council info
/council meeting "should we adopt a job queue?"
```

To run a second council, make another sub-directory and convene there. Each
folder keeps its own `.council/`, so councils never share seats, memory, or
records. (You can also convene directly inside an existing project's repo —
`.council/` is created wherever you run `convene`.)

> **Note:** the autonomous `/council work` verb edits files in a git worktree,
> so its folder must be a git repository (run `git init` once inside it).
> `convene`, `info`, and `meeting` work in any folder.

## Why a council?

**A single agent doesn't disagree with itself.** Ask one for a verdict and you get one perspective, confidently — no security engineer poking at the trust boundary, no QA hunting the edge case, no PM asking whether you're solving the right problem. `council` fixes that: it convenes a roster of opinionated **seats**, each a distinct persona, has them deliberate, and lets a **chair** synthesize one answer — while **preserving the dissent** in an auditable record instead of flattening it into false consensus.

Use it when a decision is worth more than one opinion: a design review, a "should we ship this?" gut-check, an autonomous task you want pressure-tested as it's built.

A Claude Code and Codex plugin that convenes a **council** of named **seats**, each with a unique personality, and puts them to work in an interactive **meeting** or an autonomous **work** session. The **chair** routes the others and synthesizes a single answer, keeping any dissent on the record.

See [PLAN.md](./PLAN.md) for the full design.

## Install

This repo is dual-hosted:

- Claude Code discovers `.claude-plugin/`, `commands/`, and `skills/`.
- Codex discovers `.codex-plugin/plugin.json` and the same `skills/` directory.

The root mechanics are shared. Both hosts read the bundled `templates/` and
`personalities/`, then create or use the project-local `.council/` directory.
There is no build step.

### Claude Code

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

### Codex

Install this repo as a local Codex plugin, then invoke the skill conversationally:

```
council convene software-team
council info
council meeting "should we adopt a job queue?"
council work "implement the retry helper and preserve dissents"
```

Codex does not use Claude slash commands. The `council-orchestrator` skill maps
those prompts to the same four verbs and uses Codex sub-agents for seats when a
meeting or work session is invoked.

## Commands

```
/council convene [template]        # create/recreate .council/ from a template; then edit the files
/council info                      # print a concise table of the convened council's seats
/council meeting "<task>"          # human-in-the-loop round-table; you conclude; chair synthesizes
/council meeting --frame "<q>"     # scoping mode: surface the unknowns; chair writes a BRIEF
/council work "<task>"             # autonomous take-turns in a worktree until the chair calls it done
/council work --plan               # decomposition mode: turn the active BRIEF into a reviewed ROADMAP
```

- **`convene`** stamps a template into a per-project `.council/` directory. From
  then on the council is local, editable files you own — tweak a seat's voice,
  add or drop a seat, retune the chair or the work budget.
- **`info`** prints the convened roster — seat, title, voice, with the chair
  marked — straight from the files, plus the active initiative if there is one.
  Read-only; it runs nothing.
- **`meeting`** keeps you in the loop: seats speak in turn on a shared
  scratchpad, you steer each round, and when you conclude the chair synthesizes
  the conversation into `.council/records/`.
- **`work`** takes you out of the loop: the chair picks who acts each turn and
  the seats take turns in a git worktree until the chair calls it done (or the
  budget/scratch limit is hit, or you stop it), then synthesizes and records.
  The chair never auto-merges — it hands you the worktree and the merge commands
  to run when you're ready.

### Initiative modes — `--frame` and `--plan`

For a long-horizon initiative — a research question, a project — two **modes**
ride the existing verbs (the surface stays four verbs):

- **`meeting --frame "<question>"`** runs a meeting with an *inverted* objective:
  the table surfaces what's unknown, unstated, or assumed instead of answering, and
  the chair writes a **`BRIEF.md`** (scope, locked conventions, success criteria)
  under `.council/initiatives/<slug>/`. Great for sharpening a vague research
  question before you spend effort on it.
- **`work --plan`** decomposes the active BRIEF: a planner drafts, the table
  red-teams the breakdown, and the chair writes a **`ROADMAP.md`** (phases → tasks
  with dependencies and one acceptance criterion each). It writes a document, so it
  runs without a worktree.

The **`research-lab`** template (chair `research-lead`, plus `researcher`,
`methodologist`, `critic`, `journalist`) is tuned for exactly this: frame a research
question, then plan it. Both modes write a normal record per session, so the
evolving docs stay auditable. (Carrying explicit task state across sessions and
running `work` directly against a ROADMAP task are a planned follow-up — see
[PLAN.md](./PLAN.md).)

## Layout

```
.claude-plugin/plugin.json           # plugin manifest (listed in the fingerskier/claude-plugins marketplace)
.codex-plugin/plugin.json            # Codex manifest; points at the same skills/
commands/council.md                  # slash-command entry
skills/council-orchestrator/SKILL.md # the orchestrator: routing, protocols, synthesis
personalities/*.md                   # the seat library (extensible)
templates/*.yaml                     # presets: software-team, product-engineering-team, c-suite, solo-founder, writing-lab, hedge-fund-team, research-lab
```

The council it creates lives under `.council/` in your working repo:

```
.council/
├── council.yaml      # active council: seats, chair, work budget
├── seats/*.md        # editable copies of the seat personalities
├── memory/*.md       # long-term council memory, one file per topic
├── scratch/          # ephemeral shared scratchpads (gitignored)
├── records/          # durable synthesized outputs
├── worktrees/        # git worktrees for work sessions (gitignored)
├── active-initiative # one line: the active initiative's slug (committed; optional)
└── initiatives/      # long-horizon initiatives: <slug>/BRIEF.md + <slug>/ROADMAP.md
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
two-tier memory manifest are in place. The initiative modes — `meeting --frame`
(writes a `BRIEF`) and `work --plan` (writes a `ROADMAP`) — plus the `research-lab`
template land the framing and decomposition tier; `STATE.md` continuity and running
`work` directly against a `ROADMAP` task are a planned follow-up. Per-seat model
routing is **declined** and the `convene` recreate-merge is **deferred**; see
PLAN.md §9 for the full phasing and dispositions.
