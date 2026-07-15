// Invoice-specific pure logic: parsing the row/items format and formatting.

import type { Row } from './csv.ts';

export interface LineItem {
  name: string;
  qty: number | null;
  unit: number | null;
  lineTotal: number | null;
}

export interface Invoice {
  invoiceNumber: string;
  date: string;
  vendor: string;
  customer: string;
  items: LineItem[];
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
}

// Columns every invoice CSV must provide.
export const REQUIRED_COLUMNS = [
  'invoice_number', 'date', 'vendor', 'customer', 'items',
  'subtotal', 'tax', 'discount', 'total',
] as const;

// Parse the "items" cell into structured line items.
// Format: "<name> x <qty> @ <unitPrice>" with multiple items separated by " | ".
export function parseItems(cell: string): LineItem[] {
  if (!cell) return [];
  return cell.split('|').map(part => {
    const s = part.trim();
    const m = s.match(/^(.*?)\s+x\s+([\d.]+)\s+@\s+([\d.]+)$/i);
    if (m) {
      const qty = parseFloat(m[2]);
      const unit = parseFloat(m[3]);
      return { name: m[1].trim(), qty, unit, lineTotal: qty * unit };
    }
    // Fallback: couldn't parse — show raw text with no numbers.
    return { name: s, qty: null, unit: null, lineTotal: null };
  });
}

// Format a number (or numeric string) as USD with two decimals.
// Non-numeric input is passed through unchanged.
export function money(n: number | string): string {
  const num = typeof n === 'number' ? n : parseFloat(n);
  if (!isFinite(num)) return String(n);
  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

// Map a header row to a { columnName -> index } lookup (trimmed, lowercased).
export function indexMap(header: Row): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((h, i) => { map[h.trim().toLowerCase()] = i; });
  return map;
}

// Return the required columns that are absent from the header's index map.
export function missingColumns(idx: Record<string, number>): string[] {
  return REQUIRED_COLUMNS.filter(c => !(c in idx));
}

// Build a typed Invoice from a data row using the header index map.
export function toInvoice(row: Row, idx: Record<string, number>): Invoice {
  return {
    invoiceNumber: row[idx['invoice_number']],
    date: row[idx['date']],
    vendor: row[idx['vendor']],
    customer: row[idx['customer']],
    items: parseItems(row[idx['items']]),
    subtotal: row[idx['subtotal']],
    tax: row[idx['tax']],
    discount: row[idx['discount']],
    total: row[idx['total']],
  };
}
