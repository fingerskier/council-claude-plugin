---
description: Convene a council and put it to work — convene | info | meeting | work
argument-hint: convene [template] | info | meeting [--frame] "<task>" | work [--plan]
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
---

You are the entry point for the **council** plugin. The user invoked
`/council $ARGUMENTS`.

Parse the first whitespace-delimited token of `$ARGUMENTS` as the **verb**, and
treat the remainder as the verb's argument:

- `convene [template]` — create or recreate the project's `.council/` directory
  from a template. The remainder, if present, is the template name.
- `info` — print a concise table of the convened council's seats. Takes no
  argument.
- `meeting "<task>"` — run a human-in-the-loop council meeting. The remainder is
  the task / topic. A `--frame` flag (`meeting --frame "<question>"`) runs the
  **scoping mode**: the table surfaces what's unknown instead of answering, and the
  chair writes a `BRIEF.md` for the initiative.
- `work "<task>"` — run an autonomous council work session. The remainder is the
  task. A `--plan` flag (`work --plan [--initiative <slug>]`) runs the
  **decomposition mode**: the table turns the active initiative's `BRIEF.md` into a
  reviewed `ROADMAP.md` (no worktree, no merge — it writes a document).

Before dispatching, strip any leading `--frame`/`--plan` flag and an optional
`--initiative <slug>` from the remainder, and pass them to the skill as the mode
and target initiative. `--frame` is only meaningful with `meeting`; `--plan` only
with `work`.

If the verb is missing or unrecognized, briefly list the four verbs above (noting
the `--frame`/`--plan` modes) and stop.

Now **follow the `council-orchestrator` skill** to carry out that verb. The
skill contains the full procedure for `convene`, `info`, `meeting`, and `work`,
including how to read `.council/`, spawn seat workers, drive the scratchpad, and
have the chair synthesize. For this Claude invocation, treat
`${CLAUDE_PLUGIN_ROOT}` as `COUNCIL_PLUGIN_ROOT`, the path to the plugin's
bundled `templates/` and `personalities/` directories.
