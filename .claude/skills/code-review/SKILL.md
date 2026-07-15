---
name: code-review
description: Run the code-reviewer subagent on demand. With no argument it reviews all uncommitted changes; pass a file path to review just that file.
---

Spawn the `code-reviewer` subagent (via the Agent tool, `subagent_type: "code-reviewer"`) to review code now.

- If a file path was passed as an argument, tell the subagent to review **only that file**.
- Otherwise, tell it to review **all uncommitted changes** (`git diff HEAD` plus new untracked files).

When the subagent returns, summarize its findings for the user.
