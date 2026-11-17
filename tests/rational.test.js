import test from 'node:test';
import assert from 'node:assert/strict';
import { add, compare, divide, formatRational, multiply, parseRational, subtract } from '../src/core/rational.js';

test('opera fracciones y decimales exactamente', () => {
  const x = parseRational('4/9');
  const y = parseRational('7/18');
  assert.equal(formatRational(add(x, y)), '5/6');
  assert.equal(formatRational(add(multiply(parseRational('80'), x), multiply(parseRational('100'), y))), '670/9');
  assert.equal(formatRational(subtract(parseRational('0,25'), parseRational('1/2'))), '-1/4');
  assert.equal(formatRational(divide(parseRational('1'), parseRational('-2'))), '-1/2');
  assert.equal(compare(parseRational('0,5'), parseRational('1/2')), 0);
});

test('rechaza entradas inválidas y división por cero', () => {
  for (const value of ['', '1/0', '1e3', 'NaN', '1/2/3']) {
    assert.throws(() => parseRational(value));
  }
  assert.throws(() => divide(parseRational('1'), parseRational('0')));
});
