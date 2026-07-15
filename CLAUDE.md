# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.


## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.


## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.


## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.


## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.


## 5. TypeScript, Not Plain JS

**Always use TypeScript over plain Node.js/JavaScript.**

- New files are `.ts`, not `.js`. Prefer explicit types on public functions and module boundaries.
- When touching an existing `.js` file for a non-trivial change, prefer migrating it to `.ts` rather than extending the JavaScript.
- Don't reach for `any` to silence the compiler — model the actual shape.


## 6. Document Your Work in `/docs`

**Every update leaves a written trail of your reasoning.**

For each change, add or update a Markdown note under a `docs/` folder capturing:
- **What** changed and **why** — the problem being solved.
- **Decisions** made and the alternatives you rejected (and why).
- **Assumptions and tradeoffs** — the same ones you surfaced in section 1.

Keep it concise and dated. This is the durable record of intent that the code itself can't convey.


## 7. Test With Real Unit Tests — No Mocking

**Every feature ships with unit tests that exercise real behavior.**

- Write tests that call the actual code against real inputs and assert real outputs.
- Avoid mocks, stubs, and fakes. If something is hard to test without mocking, treat that as a design signal and restructure it (pure functions, injected values, real data fixtures) instead.
- Per section 4: for bugs, write the failing test first; for features, write tests for the success and edge cases, then make them pass.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
