import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from '../src/csv.ts';
import { indexMap, toInvoice, money, type Invoice } from '../src/invoice.ts';
import { parseMoney } from '../src/parse-money.ts';
import { buildInvoicesDoc } from '../src/render-invoices.ts';
import { extractInvoicesFromPdf } from '../src/pdf-read.ts';
import type { ParsedInvoice } from '../src/pdf-extract.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const invoicesCsv = path.join(here, '..', 'invoices.csv');

let sourceInvoices: Invoice[];
let parsed: ParsedInvoice[];
let tmpPdf: string;

before(async () => {
  // Real pipeline: CSV -> Invoice[] -> formatted PDF -> parse back.
  const rows = parseCSV(fs.readFileSync(invoicesCsv, 'utf8'));
  const idx = indexMap(rows[0]);
  sourceInvoices = rows.slice(1).map(r => toInvoice(r, idx));

  tmpPdf = path.join(os.tmpdir(), `roundtrip-${process.pid}.pdf`);
  await new Promise<void>((resolve, reject) => {
    const doc = buildInvoicesDoc(sourceInvoices);
    const stream = fs.createWriteStream(tmpPdf);
    doc.pipe(stream);
    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  parsed = await extractInvoicesFromPdf(tmpPdf);
});

after(() => {
  if (tmpPdf && fs.existsSync(tmpPdf)) fs.rmSync(tmpPdf);
});

test('one parsed invoice per source row', () => {
  assert.equal(parsed.length, sourceInvoices.length);
});

test('text fields (invoice #, date, vendor, customer) round-trip exactly', () => {
  parsed.forEach((p, i) => {
    const src = sourceInvoices[i];
    assert.equal(p.invoiceNumber, src.invoiceNumber);
    assert.equal(p.date, src.date);
    assert.equal(p.vendor, src.vendor);
    assert.equal(p.customer, src.customer);
  });
});

test('money totals round-trip to the source numeric values', () => {
  parsed.forEach((p, i) => {
    const src = sourceInvoices[i];
    assert.equal(p.subtotal, Number(src.subtotal));
    assert.equal(p.tax, Number(src.tax));
    assert.equal(p.discount, Number(src.discount));
    assert.equal(p.total, Number(src.total));
  });
});

test('line items round-trip (name, qty, unit, lineTotal)', () => {
  // The formatted PDF prints currency at 2-decimal precision, so unit/lineTotal
  // are recoverable only to the cent (e.g. a $0.002 unit renders as $0.00).
  // qty and name are printed verbatim and round-trip exactly.
  const toCents = (n: number | null) => n == null ? n : parseMoney(money(n));
  parsed.forEach((p, i) => {
    const expected = sourceInvoices[i].items; // already structured by toInvoice
    assert.equal(p.items.length, expected.length);
    p.items.forEach((it, j) => {
      assert.equal(it.name, expected[j].name);
      assert.equal(it.qty, expected[j].qty);
      assert.equal(it.unit, toCents(expected[j].unit));
      assert.equal(it.lineTotal, toCents(expected[j].lineTotal));
    });
  });
});

test('a specific invoice (INV-006, has a discount) is fully recovered', () => {
  const p = parsed.find(x => x.invoiceNumber === 'INV-006');
  assert.ok(p, 'INV-006 should be present');
  assert.equal(p.vendor, 'Hooli Services');
  assert.equal(p.customer, 'Erlich Bachman');
  assert.equal(p.discount, 29.9);
  assert.equal(p.total, 293.02);
  assert.equal(p.items.length, 1);
  assert.equal(p.items[0].name, 'Cloud Storage');
});
