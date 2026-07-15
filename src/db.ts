// SQLite storage for parsed invoices, using Node's built-in node:sqlite.
// No native dependency required (Node 24+).

import { DatabaseSync } from 'node:sqlite';
import type { ParsedInvoice } from './pdf-extract.ts';

export interface VendorSpend { vendor: string; total: number; }

export function openDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  initSchema(db);
  return db;
}

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_number TEXT PRIMARY KEY,
      date           TEXT,
      vendor         TEXT,
      customer       TEXT,
      subtotal       REAL,
      tax            REAL,
      discount       REAL,
      total          REAL
    );
    CREATE TABLE IF NOT EXISTS items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT REFERENCES invoices(invoice_number),
      name           TEXT,
      qty            REAL,
      unit           REAL,
      line_total     REAL
    );
  `);
}

// Insert or update one invoice (keyed on invoice_number) and replace its items.
// Idempotent: re-running with the same data leaves the DB unchanged.
export function upsertInvoice(db: DatabaseSync, inv: ParsedInvoice): void {
  const upsert = db.prepare(`
    INSERT INTO invoices
      (invoice_number, date, vendor, customer, subtotal, tax, discount, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(invoice_number) DO UPDATE SET
      date = excluded.date,
      vendor = excluded.vendor,
      customer = excluded.customer,
      subtotal = excluded.subtotal,
      tax = excluded.tax,
      discount = excluded.discount,
      total = excluded.total
  `);
  const delItems = db.prepare('DELETE FROM items WHERE invoice_number = ?');
  const insItem = db.prepare(`
    INSERT INTO items (invoice_number, name, qty, unit, line_total)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    upsert.run(
      inv.invoiceNumber, inv.date, inv.vendor, inv.customer,
      inv.subtotal, inv.tax, inv.discount, inv.total,
    );
    delItems.run(inv.invoiceNumber);
    for (const it of inv.items) {
      insItem.run(inv.invoiceNumber, it.name, it.qty, it.unit, it.lineTotal);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function topVendorsBySpend(db: DatabaseSync, limit = 5): VendorSpend[] {
  const rows = db.prepare(`
    SELECT vendor, SUM(total) AS total
    FROM invoices
    GROUP BY vendor
    ORDER BY total DESC
    LIMIT ?
  `).all(limit);
  return rows as unknown as VendorSpend[];
}
