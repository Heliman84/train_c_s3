import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../src/csv.ts';

test('parses a simple header and rows', () => {
  const rows = parseCSV('a,b,c\n1,2,3\n4,5,6\n');
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['1', '2', '3'],
    ['4', '5', '6'],
  ]);
});

test('handles a final row without a trailing newline', () => {
  const rows = parseCSV('a,b\n1,2');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2']]);
});

test('keeps quoted commas inside a single field', () => {
  const rows = parseCSV('name,note\n"Doe, John","hi, there"\n');
  assert.deepEqual(rows, [['name', 'note'], ['Doe, John', 'hi, there']]);
});

test('unescapes doubled quotes within a quoted field', () => {
  const rows = parseCSV('q\n"she said ""hi"""\n');
  assert.deepEqual(rows, [['q'], ['she said "hi"']]);
});

test('preserves newlines inside quoted fields', () => {
  const rows = parseCSV('a\n"line1\nline2"\n');
  assert.deepEqual(rows, [['a'], ['line1\nline2']]);
});

test('ignores carriage returns (CRLF input)', () => {
  const rows = parseCSV('a,b\r\n1,2\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2']]);
});

test('drops trailing fully-empty rows', () => {
  const rows = parseCSV('a\n1\n\n\n');
  assert.deepEqual(rows, [['a'], ['1']]);
});

test('returns empty array for empty input', () => {
  assert.deepEqual(parseCSV(''), []);
});
