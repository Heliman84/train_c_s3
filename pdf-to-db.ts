#!/usr/bin/env node

/*
 * pdf-to-db.ts — Parse a formatted invoice PDF (as produced by
 * generate-invoices.ts) and store every invoice into a SQLite database.
 *
 * Usage:
 *   node pdf-to-db.ts <input.pdf> [invoices.db]
 *
 * Re-running is idempotent: invoices are upserted on invoice_number.
 */

import fs from 'node:fs';
import path from 'node:path';
import { extractInvoicesFromPdf } from './src/pdf-read.ts';
import { openDb, upsertInvoice } from './src/db.ts';

async function main(): Promise<void> {
  const [, , inputArg, dbArg] = process.argv;
  if (!inputArg) {
    console.error('Usage: node pdf-to-db.ts <input.pdf> [invoices.db]');
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: file not found: ${inputPath}`);
    process.exit(1);
  }
  const dbPath = path.resolve(dbArg ?? 'invoices.db');

  const invoices = await extractInvoicesFromPdf(inputPath);

  const db = openDb(dbPath);
  try {
    for (const inv of invoices) upsertInvoice(db, inv);
  } finally {
    db.close();
  }

  console.log(`Stored ${invoices.length} invoices into ${dbPath}`);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
