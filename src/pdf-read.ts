// pdfjs-dist I/O: read a PDF file and reconstruct one ParsedInvoice per page.
// This is the only module that touches pdfjs; all layout logic lives in the
// pure functions of ./pdf-extract.ts.

import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  groupIntoLines, extractInvoiceFromLines,
  type TextToken, type ParsedInvoice,
} from './pdf-extract.ts';

export async function extractInvoicesFromPdf(pdfPath: string): Promise<ParsedInvoice[]> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = getDocument({ data, useSystemFonts: true });
  const doc = await loadingTask.promise;

  const invoices: ParsedInvoice[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    const tokens: TextToken[] = [];
    for (const item of content.items) {
      // Text items expose `str` and a `transform` matrix; [4],[5] are x,y.
      if (!('str' in item) || !('transform' in item)) continue;
      if (item.str.trim() === '') continue;
      tokens.push({ x: item.transform[4], y: item.transform[5], str: item.str });
    }

    const lines = groupIntoLines(tokens);
    invoices.push(extractInvoiceFromLines(lines));
  }

  await loadingTask.destroy();
  return invoices;
}
