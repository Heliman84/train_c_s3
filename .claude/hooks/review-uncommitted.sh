#!/usr/bin/env bash
#
# Stop hook: when a chunk of work finishes and there are UNCOMMITTED code
# changes, ask the main agent to run the code-reviewer subagent. Fires at most
# once per distinct change-set (guarded by a hash marker) so it never loops.
#
set -euo pipefail

# Only act inside a git repo.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Current uncommitted state: tracked changes vs HEAD + the list of new files.
diff="$(git diff HEAD 2>/dev/null || true)"
untracked="$(git ls-files --others --exclude-standard 2>/dev/null || true)"

# Nothing uncommitted -> nothing to review.
if [ -z "$diff" ] && [ -z "$untracked" ]; then
  exit 0
fi

# Skip re-triggering on a change-set we already flagged this session.
hash="$(printf '%s\n%s' "$diff" "$untracked" | git hash-object --stdin)"
marker=".claude/.last-review-hash"
if [ -f "$marker" ] && [ "$(cat "$marker")" = "$hash" ]; then
  exit 0
fi
printf '%s' "$hash" > "$marker"

# Block the stop and hand the main agent an instruction to review.
cat <<'JSON'
{"decision":"block","reason":"Uncommitted code changes are present. Invoke the \"code-reviewer\" subagent now to review ONLY the uncommitted changes (git diff HEAD plus new untracked files), focusing on security, best practices, object-oriented design, and readability/reusability. The reviewer must not run tests, builds, or the code, and must not modify files. After it returns, summarize its findings for the user."}
JSON
