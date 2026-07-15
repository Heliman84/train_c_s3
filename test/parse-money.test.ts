import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney } from '../src/parse-money.ts';
import { money } from '../src/invoice.ts';

test('parses formatted currency with thousands separators', () => {
  assert.equal(parseMoney('$1,234.50'), 1234.5);
  assert.equal(parseMoney('$15,900.00'), 15900);
});

test('parses zero and small values', () => {
  assert.equal(parseMoney('$0.00'), 0);
  assert.equal(parseMoney('$45.00'), 45);
});

test('parses negative (discount) values', () => {
  assert.equal(parseMoney('-$29.90'), -29.9);
});

test('returns NaN for non-numeric input', () => {
  assert.ok(Number.isNaN(parseMoney('n/a')));
  assert.ok(Number.isNaN(parseMoney('')));
});

test('round-trips with money() for representative amounts', () => {
  for (const n of [0, 45, 469.8, 1234.5, 15900, 0.002 * 100000]) {
    assert.equal(parseMoney(money(n)), n);
  }
});
