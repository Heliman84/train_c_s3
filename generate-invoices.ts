#!/usr/bin/env node

/*
 * generate-invoices.ts — Generate a formatted invoice document (one page per
 * row) from an invoice CSV.
 *
 * Usage:
 *   node generate-invoices.ts <input.csv> [output.pdf]
 *
 * Expects the columns:
 *   invoice_number, date, vendor, customer, items, subtotal, tax, discount, total
 *
 * The `items` field is parsed from the form:
 *   "<name> x <qty> @ <unitPrice>"  (multiple items separated by " | ")
 * into a line-item table with computed line totals.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseCSV } from './src/csv.ts';
import { indexMap, missingColumns, toInvoice } from './src/invoice.ts';
import { buildInvoicesDoc } from './src/render-invoices.ts';

function main(): void {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg) {
    console.error('Usage: node generate-invoices.ts <input.csv> [output.pdf]');
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: file not found: ${inputPath}`);
    process.exit(1);
  }
  const outputPath = outputArg
    ? path.resolve(outputArg)
    : inputPath.replace(/\.csv$/i, '') + '-invoices.pdf';

  const rows = parseCSV(fs.readFileSync(inputPath, 'utf8'));
  if (rows.length < 2) {
    console.error('Error: CSV has no data rows.');
    process.exit(1);
  }

  const idx = indexMap(rows[0]);
  const missing = missingColumns(idx);
  if (missing.length) {
    console.error(`Error: CSV is missing expected columns: ${missing.join(', ')}`);
    process.exit(1);
  }

  const invoices = rows.slice(1).map(r => toInvoice(r, idx));

  const doc = buildInvoicesDoc(invoices);
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  doc.end();

  stream.on('finish', () => {
    console.log(`Wrote ${invoices.length} invoices to ${outputPath}`);
  });
  stream.on('error', (err) => {
    console.error('Error writing PDF:', err.message);
    process.exit(1);
  });
}

main();
