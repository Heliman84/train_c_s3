// Minimal CSV parser (handles quoted fields, commas, escaped quotes).
// Shared by both entry scripts so parsing behavior lives in one place.

export type Row = string[];

export function parseCSV(text: string): Row[] {
  const rows: Row[] = [];
  let field = '';
  let row: Row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // ignore; handled by \n
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  // flush last field/row if the file didn't end with a newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // drop trailing fully-empty rows
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}
