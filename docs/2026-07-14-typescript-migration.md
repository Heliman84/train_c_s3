# 2026-07-14 — Migrate scripts to TypeScript + add unit tests

## What & why

Bring the codebase into conformance with `CLAUDE.md`:

- **§5 TypeScript over plain JS** — migrated `csv-to-pdf.js` and
  `generate-invoices.js` to `.ts`.
- **§7 real unit tests, no mocking** — added `node:test` suites that exercise
  the actual code against real inputs (including the real `invoices.csv`).
- **§6 documenting the work** — this note.

## What changed

- `csv-to-pdf.js` → `csv-to-pdf.ts`, `generate-invoices.js` → `generate-invoices.ts`
  (thin entry points: arg parsing, file I/O, PDF drawing).
- Extracted the pure, side-effect-free logic into typed modules so it can be
  tested without mocks (§7 — "if something is hard to test without mocking,
  restructure it"):
  - `src/csv.ts` — `parseCSV` (was **duplicated verbatim** in both scripts; now
    a single source of truth).
  - `src/invoice.ts` — `parseItems`, `money`, `indexMap`, `missingColumns`,
    `toInvoice`, plus `LineItem`/`Invoice` types and `REQUIRED_COLUMNS`.
  - `src/table.ts` — `computeColumnWidths` (the column-sizing math).
- `test/csv.test.ts`, `test/invoice.test.ts`, `test/table.test.ts` — 23 tests,
  no mocks.
- `package.json` — `"type": "module"`, scripts (`test`, `typecheck`,
  `csv-to-pdf`, `generate-invoices`), dev deps.
- `tsconfig.json` — type-checking only (`noEmit`), `erasableSyntaxOnly`.

## Key decisions

- **Runtime: Node's native TypeScript (type stripping), no bundler/ts-node.**
  Node 24 runs `.ts` directly and has a built-in test runner, so the toolchain
  stays minimal (§2 Simplicity). `tsconfig.json` sets `erasableSyntaxOnly` so
  the source can only use TS features Node can strip (no enums/namespaces).
  TypeScript is a dev dependency purely for `tsc --noEmit` type-checking.
- **Behavior preserved, not "improved" (§3 Surgical).** The PDF drawing code was
  ported line-for-line with types added. Verified: regenerated PDFs are
  byte-identical in size to the originals (5,687 and 28,826 bytes).
- **Dedup of `parseCSV`.** The two copies were identical; unifying them is
  justified because the migration already touches both and testing wants one
  target. Not treated as unrelated refactoring.

## Assumptions / tradeoffs

- Assumed the CLI contract (args, output-path defaults, messages) should stay
  the same — only the file extension in usage strings changed (`.js` → `.ts`).
- PDF *drawing* is inherently I/O and is not unit-tested; it's covered by the
  end-to-end run below. All the extracted pure logic is unit-tested.

## Verification

- `npm run typecheck` → clean (exit 0).
- `npm test` → 23 pass, 0 fail.
- `node csv-to-pdf.ts invoices.csv` and `node generate-invoices.ts invoices.csv`
  → both produce PDFs, sizes unchanged from the pre-migration output.
