#!/usr/bin/env node

/*
 * csv-to-pdf.ts — Convert any CSV file into a table-formatted PDF.
 *
 * Usage:
 *   node csv-to-pdf.ts <input.csv> [output.pdf]
 *
 * The first CSV row is treated as the header. Every column becomes a table
 * column and every subsequent row a table row. Column widths are sized to fit
 * the page, and long cell text wraps within its column.
 */

import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { parseCSV, type Row } from './src/csv.ts';
import { computeColumnWidths } from './src/table.ts';

function main(): void {
  const [, , inputArg, outputArg] = process.argv;

  if (!inputArg) {
    console.error('Usage: node csv-to-pdf.ts <input.csv> [output.pdf]');
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: file not found: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = outputArg
    ? path.resolve(outputArg)
    : inputPath.replace(/\.csv$/i, '') + '.pdf';

  const rows = parseCSV(fs.readFileSync(inputPath, 'utf8'));
  if (rows.length === 0) {
    console.error('Error: CSV appears to be empty.');
    process.exit(1);
  }

  const header = rows[0];
  const body = rows.slice(1);
  const numCols = header.length;

  // Landscape gives more room for wide tables like invoices.
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const pageTop = doc.page.margins.top;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  const tableWidth = pageRight - pageLeft;

  // Title
  const title = path.basename(inputPath);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#000')
    .text(title, pageLeft, pageTop);
  doc.moveDown(0.5);

  const cellFontSize = 8;
  const headerFontSize = 8;
  const cellPadding = 4;

  const colWidths = computeColumnWidths(header, body, tableWidth);

  const colX: number[] = [];
  let x = pageLeft;
  for (let i = 0; i < numCols; i++) { colX.push(x); x += colWidths[i]; }

  // Measure the height a row needs (tallest wrapped cell).
  function rowHeight(cells: Row, font: string, size: number): number {
    doc.font(font).fontSize(size);
    let h = 0;
    for (let i = 0; i < numCols; i++) {
      const text = cells[i] != null ? String(cells[i]) : '';
      const hCell = doc.heightOfString(text, {
        width: colWidths[i] - cellPadding * 2,
      });
      if (hCell > h) h = hCell;
    }
    return h + cellPadding * 2;
  }

  interface RowStyle { font: string; size: number; fill?: string; textColor?: string; }

  // Draw one row of cells at vertical position y.
  function drawRow(cells: Row, y: number, style: RowStyle): number {
    const { font, size, fill, textColor } = style;
    const h = rowHeight(cells, font, size);

    if (fill) {
      doc.rect(pageLeft, y, tableWidth, h).fill(fill);
    }
    // cell borders
    doc.lineWidth(0.5).strokeColor('#cccccc');
    for (let i = 0; i < numCols; i++) {
      doc.rect(colX[i], y, colWidths[i], h).stroke();
    }
    // text
    doc.font(font).fontSize(size).fillColor(textColor || '#000');
    for (let i = 0; i < numCols; i++) {
      const text = cells[i] != null ? String(cells[i]) : '';
      doc.text(text, colX[i] + cellPadding, y + cellPadding, {
        width: colWidths[i] - cellPadding * 2,
        align: 'left',
      });
    }
    return y + h;
  }

  function drawHeader(y: number): number {
    return drawRow(header, y, {
      font: 'Helvetica-Bold', size: headerFontSize,
      fill: '#333333', textColor: '#ffffff',
    });
  }

  let y = doc.y + 4;
  y = drawHeader(y);

  for (let r = 0; r < body.length; r++) {
    const cells = body[r];
    const h = rowHeight(cells, 'Helvetica', cellFontSize);

    if (y + h > pageBottom) {
      doc.addPage();
      y = doc.page.margins.top;
      y = drawHeader(y);
    }

    const fill = r % 2 === 0 ? '#f5f5f5' : '#ffffff';
    y = drawRow(cells, y, {
      font: 'Helvetica', size: cellFontSize, fill, textColor: '#000',
    });
  }

  doc.end();

  stream.on('finish', () => {
    console.log(`Wrote ${body.length} rows (${numCols} columns) to ${outputPath}`);
  });
  stream.on('error', (err) => {
    console.error('Error writing PDF:', err.message);
    process.exit(1);
  });
}

main();
