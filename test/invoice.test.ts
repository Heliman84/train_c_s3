import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from '../src/csv.ts';
import {
  parseItems, money, indexMap, missingColumns, toInvoice, REQUIRED_COLUMNS,
} from '../src/invoice.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const invoicesCsv = path.join(here, '..', 'invoices.csv');

test('parseItems parses a single "<name> x <qty> @ <unit>" item', () => {
  assert.deepEqual(parseItems('Office Chair x 2 @ 150.00'), [
    { name: 'Office Chair', qty: 2, unit: 150, lineTotal: 300 },
  ]);
});

test('parseItems splits multiple items on the pipe separator', () => {
  const items = parseItems('Office Chair x 2 @ 150.00 | Desk Lamp x 3 @ 45.00');
  assert.equal(items.length, 2);
  assert.deepEqual(items[1], { name: 'Desk Lamp', qty: 3, unit: 45, lineTotal: 135 });
});

test('parseItems keeps fractional quantities and unit prices', () => {
  assert.deepEqual(parseItems('API Credits x 100000 @ 0.002'), [
    { name: 'API Credits', qty: 100000, unit: 0.002, lineTotal: 200 },
  ]);
});

test('parseItems falls back to raw text when the format does not match', () => {
  assert.deepEqual(parseItems('mystery blob'), [
    { name: 'mystery blob', qty: null, unit: null, lineTotal: null },
  ]);
});

test('parseItems returns [] for an empty cell', () => {
  assert.deepEqual(parseItems(''), []);
});

test('money formats numbers and numeric strings as USD', () => {
  assert.equal(money(1234.5), '$1,234.50');
  assert.equal(money('50'), '$50.00');
  assert.equal(money(0), '$0.00');
});

test('money passes non-numeric input through unchanged', () => {
  assert.equal(money('n/a'), 'n/a');
});

test('indexMap lowercases and trims header names', () => {
  const idx = indexMap([' Invoice_Number ', 'Total']);
  assert.equal(idx['invoice_number'], 0);
  assert.equal(idx['total'], 1);
});

test('missingColumns reports absent required columns', () => {
  const idx = indexMap(['invoice_number', 'date', 'vendor']);
  const missing = missingColumns(idx);
  assert.ok(missing.includes('customer'));
  assert.ok(missing.includes('total'));
  assert.ok(!missing.includes('invoice_number'));
});

test('missingColumns is empty when every required column is present', () => {
  const idx = indexMap([...REQUIRED_COLUMNS]);
  assert.deepEqual(missingColumns(idx), []);
});

test('the real invoices.csv has no missing columns and maps every row', () => {
  const rows = parseCSV(fs.readFileSync(invoicesCsv, 'utf8'));
  const idx = indexMap(rows[0]);
  assert.deepEqual(missingColumns(idx), []);

  const first = toInvoice(rows[1], idx);
  assert.equal(first.invoiceNumber, 'INV-001');
  assert.equal(first.customer, 'Sarah Chen');
  assert.equal(first.items.length, 2);
  assert.equal(first.items[0].lineTotal, 300);
  assert.equal(money(first.total), '$469.80');
});
