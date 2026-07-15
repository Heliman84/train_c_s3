# 2026-07-15 — Parse invoice PDFs into SQLite + top-vendors report

## What & why

Add the reverse of the PDF generators plus a small analytics query:

- **`pdf-to-db.ts`** — reads a formatted invoice PDF (the one-page-per-invoice
  document from `generate-invoices.ts`) and stores every field
  (invoice #, date, vendor, customer, line items, subtotal/tax/discount/total)
  into a **SQLite** database.
- **`top-vendors.ts`** — prints the top 5 vendors by total spend from that DB.

## Key decisions

- **Input = the formatted PDF** (`invoices-formatted.pdf`), per user choice —
  not the table PDF. It looks like a real invoice; parsing it is the interesting
  case.
- **SQLite via Node's built-in `node:sqlite`** (`DatabaseSync`). Node 24 ships
  it, so there is **no native dependency** (avoids `better-sqlite3` compilation).
  It is still experimental and emits an `ExperimentalWarning` to stderr — left
  as-is.
- **`pdfjs-dist` for extraction** (one new runtime dependency). We need the
  per-token **x/y coordinates** it exposes: the layout has right-aligned totals
  and multi-column line items that plain text extraction (e.g. `pdf-parse`)
  cannot disambiguate. Rejected `pdf-parse` for that reason.
- **Upsert on `invoice_number`** — re-parsing is idempotent (no double-counting).
- **Coordinate logic is anchored to labels**, not magic offsets: `Invoice #:`,
  `Date:`, `BILL TO`, the `DESCRIPTION/QTY/UNIT/AMOUNT` header (column
  boundaries = midpoints between header token x-positions), and the
  `Subtotal/Tax/Discount/TOTAL` rows.

## Structure (follows existing architecture)

Pure, typed logic in `src/`; thin entry scripts at root; real no-mock tests.

- `src/parse-money.ts` — `parseMoney` (inverse of `money`).
- `src/pdf-extract.ts` — **pure** reconstruction: `groupIntoLines`,
  `extractInvoiceFromLines`, types `TextToken`/`TextLine`/`ParsedInvoice`. No
  pdfjs import, so it is directly unit-testable.
- `src/pdf-read.ts` — the only pdfjs-touching module
  (`extractInvoicesFromPdf`), using `pdfjs-dist/legacy/build/pdf.mjs`.
- `src/db.ts` — `node:sqlite` layer: `openDb`, `initSchema`, `upsertInvoice`
  (transactional upsert + item replace), `topVendorsBySpend`.
- `src/render-invoices.ts` — **refactor**: `drawInvoice` + geometry moved out of
  `generate-invoices.ts` into `buildInvoicesDoc(invoices)`, so the CLI and the
  round-trip test render identically. Behavior-preserving (verified: still
  produces a 25-page 28,826-byte PDF for the sample data).

## Assumptions / tradeoffs

- **Currency recovers only to the cent.** The formatted PDF prints money at
  2-decimal precision, so a sub-cent unit price (INV-014, `@ 0.002`) renders as
  `$0.00` and cannot be recovered from the PDF. This is a property of the medium,
  not a parser bug; the round-trip test asserts cent-precision explicitly. The
  line total (`$200.00`) and quantity (100000) recover exactly.
- Discount is only drawn when `> 0`, so absent → `0`; stored as a positive
  magnitude to match the CSV's convention.
- Parser is tuned to this specific layout (the whole point was the reverse of
  our own generator). It is not a general-purpose invoice parser.

## Testing (real inputs, no mocks — CLAUDE.md §7)

- `test/parse-money.test.ts` — formatting inverse, incl. `money`↔`parseMoney` round trip.
- `test/pdf-roundtrip.test.ts` — the core test: real `invoices.csv` → `buildInvoicesDoc` → temp PDF → `extractInvoicesFromPdf`, asserting all 25 invoices' text, totals, and items recover (currency to the cent).
- `test/db.test.ts` — in-memory `DatabaseSync`: top-vendors ordering/sums, `limit`, and upsert idempotency (no duplicate rows/items, no double-counting).

## Verification

- `npm run typecheck` → clean.
- `npm test` → 37 pass, 0 fail.
- End-to-end: `generate-invoices` → `pdf-to-db` → `top-vendors` produced the top
  5, which **matched an independent `awk` sum of `total` per `vendor`** over
  `invoices.csv` exactly (Wayne Industries $28,860.00, Northwind $6,320.16, Pied
  Piper $5,544.02, Globex $4,981.04, Initech $4,424.00).
- Re-running `pdf-to-db` kept the DB at 25 invoices / 36 items (idempotent).
