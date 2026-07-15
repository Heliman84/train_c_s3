import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initSchema, upsertInvoice, topVendorsBySpend } from '../src/db.ts';
import type { ParsedInvoice } from '../src/pdf-extract.ts';

function inv(
  invoiceNumber: string, vendor: string, total: number,
): ParsedInvoice {
  return {
    invoiceNumber, date: '2025-01-01', vendor, customer: 'Someone',
    items: [{ name: 'Thing', qty: 1, unit: total, lineTotal: total }],
    subtotal: total, tax: 0, discount: 0, total,
  };
}

test('topVendorsBySpend ranks vendors by summed total, descending', () => {
  const db = new DatabaseSync(':memory:');
  initSchema(db);

  upsertInvoice(db, inv('A-1', 'Acme', 100));
  upsertInvoice(db, inv('A-2', 'Acme', 250));      // Acme total 350
  upsertInvoice(db, inv('G-1', 'Globex', 900));    // Globex total 900
  upsertInvoice(db, inv('W-1', 'Wayne', 500));      // Wayne total 500

  const top = topVendorsBySpend(db, 5);
  assert.deepEqual(top.map(v => v.vendor), ['Globex', 'Wayne', 'Acme']);
  assert.equal(top[0].total, 900);
  assert.equal(top.find(v => v.vendor === 'Acme')?.total, 350);
  db.close();
});

test('limit caps the number of vendors returned', () => {
  const db = new DatabaseSync(':memory:');
  initSchema(db);
  for (let i = 0; i < 8; i++) upsertInvoice(db, inv(`X-${i}`, `V${i}`, i * 10 + 1));
  assert.equal(topVendorsBySpend(db, 5).length, 5);
  db.close();
});

test('upsert is idempotent — re-storing does not duplicate or double-count', () => {
  const db = new DatabaseSync(':memory:');
  initSchema(db);

  const record = inv('DUP-1', 'Acme', 300);
  upsertInvoice(db, record);
  upsertInvoice(db, record); // same invoice again

  const invoiceCount = db.prepare('SELECT COUNT(*) AS n FROM invoices').get() as { n: number };
  const itemCount = db.prepare('SELECT COUNT(*) AS n FROM items').get() as { n: number };
  assert.equal(invoiceCount.n, 1);
  assert.equal(itemCount.n, 1);

  const top = topVendorsBySpend(db, 5);
  assert.equal(top[0].total, 300); // not 600
  db.close();
});

test('upsert updates fields when the same invoice is re-parsed with new values', () => {
  const db = new DatabaseSync(':memory:');
  initSchema(db);
  upsertInvoice(db, inv('C-1', 'Acme', 100));
  upsertInvoice(db, inv('C-1', 'Acme Corp', 175)); // corrected vendor + total

  const row = db.prepare('SELECT vendor, total FROM invoices WHERE invoice_number = ?')
    .get('C-1') as { vendor: string; total: number };
  assert.equal(row.vendor, 'Acme Corp');
  assert.equal(row.total, 175);
  db.close();
});
