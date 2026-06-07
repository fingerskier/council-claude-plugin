# Council — Plugin Plan

A Claude Code plugin that turns the CLI into a multi-perspective deliberation engine. You convene a **council** of named **seats** (personalities), hand them a task, and they deliberate under a chosen protocol while a **chair** synthesizes a single answer.

## 1. Core idea

Personalities are *data*, not registered agents. The plugin ships:

- **one orchestrator** (a skill + a slash command),
- a **library of personality files** (markdown), and
- **council presets** (named compositions of seats).

At invocation the orchestrator selects personality files, builds a worker per file, fans the task out, and folds the results back through a chair. The roster is always `count(selected personalities)` — fully dynamic, nothing pre-registered. Adding a `personalities/historian.md` tomorrow makes it available with zero code change.

This sidesteps the fixed-roster limit: registered plugin subagents are a static set, but *spawned* workers carrying a personality prompt are not. The personality is just a string the orchestrator injects at spawn time. (It also dodges the plugin-subagent restriction that bans `hooks`/`mcpServers`/`permissionMode` frontmatter, since these workers aren't registered plugin subagents.)

## 2. Plugin structure

```
council/
├── .claude-plugin/plugin.json
├── skills/
│   └── council-orchestrator/SKILL.md   # the brain: selection, fan-out, synthesis
├── commands/
│   └── council.md                       # slash-command entry, delegates to skill
├── personalities/                       # the seat library (extensible)
│   ├── ceo.md  cfo.md  cto.md  coo.md  chief-counsel.md
│   ├── staff-engineer.md  security-engineer.md  qa-engineer.md  product-manager.md
│   └── editor.md  line-editor.md  critic.md  researcher.md
├── councils/                            # preset compositions
│   ├── c-suite.yaml
│   ├── engineering-team.yaml
│   └── writing-lab.yaml
└── README.md
```

## 3. Personality file format

Frontmatter mirrors the subagent schema so a personality maps cleanly onto a spawned worker (and, in headless mode, straight into an `--agents` JSON entry). The body *is* the system prompt.

```markdown
---
name: cfo
title: Chief Financial Officer
seat: c-suite
model: sonnet            # cheap voices on cheaper models; chair on opus
voice: skeptical, numbers-driven, risk-averse
tools: [read, web_search]   # optional per-seat tool restriction
---
You are the CFO on this council. Evaluate every proposal through capital
efficiency, runway, and downside risk. Quantify where possible. Name the
assumption that would have to be true for this to pay off. Be terse.
```

Convention: keep the body a *persona*, not a task. The task is injected at runtime.

## 4. Council presets (the "shape")

A preset names the seats, the chair (synthesizer), and a default deliberation mode. These are the prebuilts — C-suite, engineering team, writing lab — and users can add their own.

```yaml
# councils/c-suite.yaml
name: c-suite
description: Executive decision council
chair: ceo
default_mode: panel
seats: [ceo, cfo, cto, coo, chief-counsel]
```

```yaml
# councils/engineering-team.yaml
name: engineering-team
description: Technical design + review council
chair: staff-engineer
default_mode: review
seats: [staff-engineer, security-engineer, qa-engineer, product-manager]
```

```yaml
# councils/writing-lab.yaml
name: writing-lab
description: Draft, critique, and tighten prose
chair: editor
default_mode: review
seats: [editor, line-editor, critic]
```

## 5. Job modes (deliberation protocols)

A "job" runs one or more seats against a task. Mode controls topology and cost.

| Mode | Topology | Use for | Cost |
|------|----------|---------|------|
| `solo` | one seat answers | quick single perspective | 1 worker |
| `panel` | all seats answer in parallel, chair synthesizes | breadth, decisions | N parallel + 1 |
| `debate` | seats see each other's takes over R rounds, may revise; chair calls it | contested calls, stress-testing | N × R + 1, sequential |
| `review` | a draft is produced, remaining seats critique, chair revises | writing, design review, red-team | 1 + (N−1) + 1 |

`panel` is the default fan-out/fan-in; `debate` and `review` add structure at higher token cost.

## 6. Invocation surface

```
/council list                                   # show seats + presets
/council ask <seat> "<task>"                     # solo
/council convene <preset> [--mode M] "<task>"    # run a preset
/council adhoc <seat,seat,...> [--mode M] "<task>"   # ad-hoc composition
/council new-seat <name>                         # scaffold a personality file
```

`--mode` overrides the preset's `default_mode`. `--rounds N` bounds `debate`. `--model` overrides the chair's model.

## 7. Output synthesis

The chair seat receives the original task plus every worker's output and produces:

1. a **unified recommendation** (the headline answer),
2. **dissents** — where seats disagreed and why, preserved not flattened,
3. optionally a **transcript artifact** with each seat's raw take, so you can audit the reasoning.

Dissent preservation is the point of a council — a synthesis that erases disagreement is just one opinion in a trench coat.

## 8. Technical approach

- **Interactive (primary):** the orchestrator skill drives Task-tool subagents, constructing each subagent's prompt from `personalities/<seat>.md` + the injected task. Parallel for `panel`, sequenced for `debate`/`review`.
- **Headless/SDK:** emit an `--agents` JSON object keyed by seat name, with each personality body as the `prompt`. Same files, two delivery paths.
- **Model routing for cost:** run voices on a cheaper model and reserve the strong model for the chair's synthesis. A wide `panel` or multi-round `debate` can burn far more tokens than a normal session — make this explicit and put a guardrail on `debate` rounds.

## 9. MVP and phasing

**Phase 1 — walking skeleton**
- `plugin.json`, orchestrator skill, personality format
- `ask` (solo) and `convene <preset> --mode panel` with chair synthesis
- the three prebuilt presets + ~12 personality files

**Phase 2 — protocols**
- `debate` and `review` modes
- `list`, `adhoc`
- transcript artifact output

**Phase 3 — polish**
- `new-seat` scaffolding command
- per-seat model routing + cost guardrails
- persist council verdicts (decision + dissents) to Reqall for later recall

## 10. Open decisions (need your call)

1. **State between seats.** Stateless workers (clean, parallel) or shared scratchpad (richer debate, more plumbing)? MVP assumes stateless.
2. **Chair as seat vs. orchestrator role.** Is the chair a personality file that synthesizes, or a fixed orchestrator function? Plan assumes a personality file, so its voice is tunable.
3. **Deadlock handling in `debate`.** Hard round cap, or let the chair force a call early? Plan caps rounds.
4. **Isolation.** Per-worker worktrees (your cross-x style) for jobs that touch the filesystem, or read-only voices by default? Plan defaults voices to read-only.
5. **Reqall integration depth.** Just log verdicts, or let seats query project context as a tool during deliberation?

---

*This maps almost directly onto your corkboard moderator/worker topology: the chair is the moderator, the seats are workers, and the personality library is the part corkboard doesn't have yet.*
