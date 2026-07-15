// Pure reconstruction of an invoice from positioned PDF text tokens.
// No pdfjs import here — this operates on plain {x, y, str} data so it can be
// unit-tested directly. The pdfjs I/O lives in ./pdf-read.ts.

import type { LineItem } from './invoice.ts';
import { parseMoney } from './parse-money.ts';

export interface TextToken { x: number; y: number; str: string; }
export interface TextLine { y: number; tokens: TextToken[]; } // tokens sorted by x

// An invoice recovered from a PDF. Same shape as Invoice but money fields are
// numbers (the PDF stores them formatted, and we parse them back).
export interface ParsedInvoice {
  invoiceNumber: string;
  date: string;
  vendor: string;
  customer: string;
  items: LineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

// Group tokens into lines by y (PDF y increases upward), sorted top→bottom.
// Tokens within `yTol` points share a line; each line's tokens are sorted by x.
export function groupIntoLines(tokens: TextToken[], yTol = 2): TextLine[] {
  const sorted = [...tokens].sort((a, b) => b.y - a.y);
  const lines: TextLine[] = [];
  for (const t of sorted) {
    const line = lines.find(l => Math.abs(l.y - t.y) <= yTol);
    if (line) {
      line.tokens.push(t);
    } else {
      lines.push({ y: t.y, tokens: [t] });
    }
  }
  for (const l of lines) l.tokens.sort((a, b) => a.x - b.x);
  return lines;
}

// Reconstruct one invoice from the lines of a single page.
export function extractInvoiceFromLines(lines: TextLine[]): ParsedInvoice {
  const joinText = (l: TextLine) => l.tokens.map(t => t.str).join(' ').trim();

  // vendor: the topmost line (highest y), right-aligned above the "Vendor" label.
  const vendor = lines.length ? joinText(lines[0]) : '';

  // invoice # / date: single tokens like "Invoice #: INV-001" / "Date: 2025-01-03".
  const afterPrefix = (prefix: string): string => {
    for (const l of lines) {
      for (const t of l.tokens) {
        if (t.str.startsWith(prefix)) return t.str.slice(prefix.length).trim();
      }
    }
    return '';
  };
  const invoiceNumber = afterPrefix('Invoice #:');
  const date = afterPrefix('Date:');

  // customer: the line immediately below the "BILL TO" line.
  const billToIdx = lines.findIndex(l => joinText(l) === 'BILL TO');
  const customer = billToIdx >= 0 && billToIdx + 1 < lines.length
    ? joinText(lines[billToIdx + 1]) : '';

  // Line-item table: header line (has DESCRIPTION/QTY/UNIT/AMOUNT) → boundaries.
  const headerIdx = lines.findIndex(l =>
    l.tokens.some(t => t.str === 'DESCRIPTION'));
  const totalsIdx = lines.findIndex(l =>
    l.tokens.some(t => t.str === 'Subtotal'));

  const items: LineItem[] = [];
  if (headerIdx >= 0 && totalsIdx > headerIdx) {
    const header = lines[headerIdx].tokens;
    const xOf = (label: string) => header.find(t => t.str === label)?.x ?? Infinity;
    const descX = xOf('DESCRIPTION');
    const qtyX = xOf('QTY');
    const unitX = xOf('UNIT');
    const amountX = xOf('AMOUNT');
    // Column boundaries: midpoints between adjacent header anchors.
    const bNameQty = (descX + qtyX) / 2;
    const bQtyUnit = (qtyX + unitX) / 2;
    const bUnitAmount = (unitX + amountX) / 2;

    for (let i = headerIdx + 1; i < totalsIdx; i++) {
      const nameParts: string[] = [];
      let qty = '', unit = '', amount = '';
      for (const t of lines[i].tokens) {
        if (t.x < bNameQty) nameParts.push(t.str);
        else if (t.x < bQtyUnit) qty = t.str;
        else if (t.x < bUnitAmount) unit = t.str;
        else amount = t.str;
      }
      const name = nameParts.join(' ').trim();
      if (qty === '' && unit === '' && amount === '') {
        // Wrapped-name continuation: append to previous item.
        if (items.length && name) items[items.length - 1].name += ' ' + name;
        continue;
      }
      items.push({
        name,
        qty: qty === '' ? null : Number(qty),
        unit: unit === '' ? null : parseMoney(unit),
        lineTotal: amount === '' ? null : parseMoney(amount),
      });
    }
  }

  // Totals: each totals line has a label token and a right-aligned value token.
  const totalValue = (label: string): number => {
    for (const l of lines) {
      if (l.tokens.some(t => t.str === label)) {
        const value = l.tokens[l.tokens.length - 1]; // rightmost token
        return parseMoney(value.str);
      }
    }
    return NaN;
  };
  const subtotal = totalValue('Subtotal');
  const tax = totalValue('Tax');
  const total = totalValue('TOTAL');
  // Discount is only rendered when > 0; default to 0 and store its magnitude.
  const discRaw = totalValue('Discount');
  const discount = Number.isNaN(discRaw) ? 0 : Math.abs(discRaw);

  return {
    invoiceNumber, date, vendor, customer, items,
    subtotal, tax, discount, total,
  };
}
