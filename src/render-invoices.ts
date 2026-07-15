// Render Invoice records to a formatted PDF (one page per invoice).
// Shared by the generate-invoices CLI and the round-trip test so both produce
// byte-identical output.

import PDFDocument from 'pdfkit';
import { money, type Invoice } from './invoice.ts';

interface Geometry { left: number; right: number; contentWidth: number; }

// Build (but do not finalize) a PDF document containing one page per invoice.
// The caller pipes the returned doc to a destination and calls doc.end().
export function buildInvoicesDoc(invoices: Invoice[]): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const contentWidth = right - left;

  invoices.forEach((inv, i) => {
    if (i > 0) doc.addPage();
    drawInvoice(doc, inv, { left, right, contentWidth });
  });

  return doc;
}

function drawInvoice(doc: PDFKit.PDFDocument, inv: Invoice, geo: Geometry): void {
  const { left, right, contentWidth } = geo;

  // ---- Header band ----
  doc.font('Helvetica-Bold').fontSize(26).fillColor('#1a1a1a')
    .text('INVOICE', left, 50);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a')
    .text(inv.vendor, left, 50, { width: contentWidth, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#666')
    .text('Vendor', left, 66, { width: contentWidth, align: 'right' });

  // Invoice meta
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  doc.text(`Invoice #: ${inv.invoiceNumber}`, left, 90);
  doc.text(`Date: ${inv.date}`, left, 104);

  // Bill-to
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#666')
    .text('BILL TO', left, 135);
  doc.font('Helvetica').fontSize(11).fillColor('#1a1a1a')
    .text(inv.customer, left, 150);

  // Divider
  doc.moveTo(left, 175).lineTo(right, 175).lineWidth(1)
    .strokeColor('#dddddd').stroke();

  // ---- Line-item table ----
  const cols = {
    desc: left,
    qty: left + contentWidth * 0.55,
    unit: left + contentWidth * 0.70,
    total: left + contentWidth * 0.85,
  };
  const colEnd = right;

  let y = 190;
  // Header row
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
  doc.rect(left, y, contentWidth, 20).fill('#333333');
  doc.fillColor('#ffffff');
  doc.text('DESCRIPTION', cols.desc + 6, y + 6, { width: cols.qty - cols.desc - 6 });
  doc.text('QTY', cols.qty, y + 6, { width: cols.unit - cols.qty - 6, align: 'right' });
  doc.text('UNIT', cols.unit, y + 6, { width: cols.total - cols.unit - 6, align: 'right' });
  doc.text('AMOUNT', cols.total, y + 6, { width: colEnd - cols.total - 6, align: 'right' });
  y += 20;

  // Item rows
  doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
  inv.items.forEach((it, i) => {
    const descWidth = cols.qty - cols.desc - 12;
    const descHeight = doc.heightOfString(it.name, { width: descWidth });
    const rowH = Math.max(20, descHeight + 8);

    if (i % 2 === 1) {
      doc.rect(left, y, contentWidth, rowH).fill('#f7f7f7');
    }
    doc.fillColor('#1a1a1a').font('Helvetica').fontSize(10);
    doc.text(it.name, cols.desc + 6, y + 5, { width: descWidth });
    doc.text(it.qty != null ? String(it.qty) : '', cols.qty, y + 5,
      { width: cols.unit - cols.qty - 6, align: 'right' });
    doc.text(it.unit != null ? money(it.unit) : '', cols.unit, y + 5,
      { width: cols.total - cols.unit - 6, align: 'right' });
    doc.text(it.lineTotal != null ? money(it.lineTotal) : '', cols.total, y + 5,
      { width: colEnd - cols.total - 6, align: 'right' });
    y += rowH;
  });

  // Line under items
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5)
    .strokeColor('#dddddd').stroke();
  y += 12;

  // ---- Totals block (right-aligned) ----
  const labelX = left + contentWidth * 0.60;
  const valX = left + contentWidth * 0.80;
  const valW = right - valX;
  const labelW = valX - labelX - 6;

  interface TotalOpts { bold?: boolean; color?: string; }
  function totalLine(label: string, value: string, opts: TotalOpts = {}): void {
    const font = opts.bold ? 'Helvetica-Bold' : 'Helvetica';
    const size = opts.bold ? 12 : 10;
    doc.font(font).fontSize(size).fillColor(opts.color || '#333');
    doc.text(label, labelX, y, { width: labelW, align: 'right' });
    doc.text(value, valX, y, { width: valW, align: 'right' });
    y += opts.bold ? 20 : 16;
  }

  totalLine('Subtotal', money(inv.subtotal));
  totalLine('Tax', money(inv.tax));
  const disc = parseFloat(inv.discount);
  if (isFinite(disc) && disc > 0) {
    totalLine('Discount', '-' + money(disc));
  }

  // Divider above grand total
  doc.moveTo(labelX, y + 2).lineTo(right, y + 2).lineWidth(1)
    .strokeColor('#333333').stroke();
  y += 8;
  totalLine('TOTAL', money(inv.total), { bold: true, color: '#1a1a1a' });

  // ---- Footer ----
  doc.font('Helvetica').fontSize(9).fillColor('#999')
    .text('Thank you for your business.', left,
      doc.page.height - doc.page.margins.bottom - 20,
      { width: contentWidth, align: 'center' });
}
