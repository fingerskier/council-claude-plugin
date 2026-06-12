---
description: Convene a council and put it to work — convene | info | meeting | work
argument-hint: convene [template] | info | meeting "<task>" | work "<task>"
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
  the task / topic.
- `work "<task>"` — run an autonomous council work session. The remainder is the
  task.

If the verb is missing or unrecognized, briefly list the four verbs above and
stop.

Now **follow the `council-orchestrator` skill** to carry out that verb. The
skill contains the full procedure for `convene`, `info`, `meeting`, and `work`,
including how to read `.council/`, spawn seat workers, drive the scratchpad, and
have the chair synthesize. Use `${CLAUDE_PLUGIN_ROOT}` as the path to the
plugin's bundled `templates/` and `personalities/` directories.
