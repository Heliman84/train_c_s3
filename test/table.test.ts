import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeColumnWidths } from '../src/table.ts';

const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

test('widths always sum to the table width', () => {
  const header = ['id', 'description', 'x'];
  const body = [
    ['1', 'a fairly long description here', 'y'],
    ['2', 'short', 'z'],
  ];
  const widths = computeColumnWidths(header, body, 900);
  const sum = widths.reduce((a, b) => a + b, 0);
  assert.ok(approx(sum, 900), `expected sum 900, got ${sum}`);
});

test('the column with the longest content is the widest', () => {
  const header = ['a', 'b', 'c'];
  const body = [['x', 'this is by far the longest cell', 'y']];
  const widths = computeColumnWidths(header, body, 600);
  assert.ok(widths[1] > widths[0]);
  assert.ok(widths[1] > widths[2]);
});

test('equal-length columns get equal widths', () => {
  const header = ['aa', 'bb', 'cc'];
  const body = [['11', '22', '33']];
  const widths = computeColumnWidths(header, body, 300);
  assert.ok(approx(widths[0], widths[1]));
  assert.ok(approx(widths[1], widths[2]));
  assert.ok(approx(widths[0], 100));
});

test('header length counts when it exceeds every body cell', () => {
  const header = ['a_very_long_header_name', 'b'];
  const body = [['x', 'y']];
  const widths = computeColumnWidths(header, body, 500);
  assert.ok(widths[0] > widths[1]);
});
