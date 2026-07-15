// Parse a currency-formatted string back into a number.
// Inverse of `money` in ./invoice.ts: strips "$" and thousands separators,
// keeps a leading minus. Returns NaN for non-numeric input.
export function parseMoney(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, '');
  if (cleaned === '' || cleaned === '-') return NaN;
  return Number(cleaned);
}
