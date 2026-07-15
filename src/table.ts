// Pure table-layout math for csv-to-pdf: sizing columns to fill the page.

import type { Row } from './csv.ts';

// Weight each column by the longest content it holds (header or any body cell),
// then normalize so the widths sum exactly to `tableWidth`. Every column gets at
// least `minWidth` points before normalization.
export function computeColumnWidths(
  header: Row,
  body: Row[],
  tableWidth: number,
  minWidth = 40,
): number[] {
  const colMaxLen = header.map((h, i) => {
    let max = String(h).length;
    for (const r of body) {
      const v = r[i] != null ? String(r[i]) : '';
      if (v.length > max) max = v.length;
    }
    return Math.max(max, 3);
  });

  const totalLen = colMaxLen.reduce((a, b) => a + b, 0);
  const colWidths = colMaxLen.map(len =>
    Math.max(minWidth, (len / totalLen) * tableWidth),
  );

  // Normalize so widths sum exactly to tableWidth.
  const widthSum = colWidths.reduce((a, b) => a + b, 0);
  const scale = tableWidth / widthSum;
  return colWidths.map(w => w * scale);
}
