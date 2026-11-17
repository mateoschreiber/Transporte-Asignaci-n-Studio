// Exact fractions for linear-programming calculations.
function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function fraction(numerator, denominator = 1n) {
  if (denominator === 0n) throw new RangeError('El denominador no puede ser cero.');
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function parseRational(value) {
  const text = String(value ?? '').trim();
  if (text.length > 80 || !/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:\/[+-]?\d+)?$/.test(text)) {
    throw new TypeError('Ingresa un entero, decimal o fracción válida.');
  }
  const [decimal, denominator = '1'] = text.replace(',', '.').split('/');
  const sign = decimal.startsWith('-') ? -1n : 1n;
  const [whole, places = ''] = decimal.replace(/^[+-]/, '').split('.');
  const numerator = sign * BigInt((whole || '0') + places);
  return fraction(numerator, 10n ** BigInt(places.length) * BigInt(denominator));
}

export const add = (a, b) => fraction(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
export const subtract = (a, b) => fraction(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
export const multiply = (a, b) => fraction(a.numerator * b.numerator, a.denominator * b.denominator);
export const divide = (a, b) => fraction(a.numerator * b.denominator, a.denominator * b.numerator);
export const compare = (a, b) => {
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
};
export const formatRational = (value) => value.denominator === 1n
  ? String(value.numerator)
  : value.numerator + '/' + value.denominator;
