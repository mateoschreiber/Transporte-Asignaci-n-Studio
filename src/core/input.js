export const MAX_DIMENSION = 32;
const VALUE_LIMIT = Math.floor(Number.MAX_SAFE_INTEGER / 8);

export class InputError extends Error {
  constructor(message, field = '') {
    super(message);
    this.name = 'InputError';
    this.field = field;
  }
}

function decimal(value, label, field, nonnegative) {
  const text = String(value ?? '').trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text) || text.length > 24) {
    throw new InputError('Ingresa un número válido en ' + label + '.', field);
  }
  const canonical = text.replace(',', '.');
  const [whole, fraction = ''] = canonical.replace(/^[+-]/, '').split('.');
  const scale = 10 ** fraction.length;
  const magnitude = Number(whole + fraction);
  const units = canonical.startsWith('-') && magnitude !== 0 ? -magnitude : magnitude;
  if (!Number.isSafeInteger(scale) || !Number.isSafeInteger(units) || (nonnegative && units < 0)) {
    throw new InputError(label + ' está fuera del rango permitido.', field);
  }
  return { units, scale };
}

export function decimals(entries, nonnegative = false) {
  const parsed = entries.map(([value, label, field]) => decimal(value, label, field, nonnegative));
  const scale = parsed.reduce((maximum, item) => Math.max(maximum, item.scale), 1);
  const values = parsed.map((item, index) => {
    const scaled = item.units * (scale / item.scale);
    if (!Number.isSafeInteger(scaled) || Math.abs(scaled) > VALUE_LIMIT) {
      throw new InputError('La precisión conjunta excede el rango seguro.', entries[index][2]);
    }
    return scaled;
  });
  return { values, scale };
}

export function numberAtScale(value, scale, label = 'la respuesta') {
  const item = decimal(value, label, '', false);
  const units = item.units * (scale / item.scale);
  if (!Number.isSafeInteger(units)) {
    throw new InputError('Usa un valor que pueda expresarse con la precisión del ejercicio.');
  }
  return units;
}

export function validateShape(draft) {
  const m = draft.rows?.length;
  const n = draft.columns?.length;
  if (!Number.isInteger(m) || !Number.isInteger(n) || m < 1 || n < 1 ||
      m > MAX_DIMENSION || n > MAX_DIMENSION || !Array.isArray(draft.costs) || draft.costs.length !== m ||
      draft.costs.some((row) => !Array.isArray(row) || row.length !== n)) {
    throw new InputError('La matriz debe tener entre 1 y ' + MAX_DIMENSION + ' filas y columnas.');
  }
  return { m, n };
}

export const sum = (values) => values.reduce((total, value) => total + value, 0);
export const copyMatrix = (matrix) => matrix.map((row) => [...row]);
export const grid = (m, n, value = 0) => Array.from({ length: m }, () => Array(n).fill(value));

export function assertArithmetic(bound) {
  if (!Number.isSafeInteger(bound) || bound > VALUE_LIMIT) {
    throw new InputError('Los datos juntos exceden el rango seguro de cálculo. Reduce su magnitud o precisión.');
  }
}

export function parseCosts(draft) {
  const { m, n } = validateShape(draft);
  const entries = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (draft.costs[i][j] !== null) {
        entries.push([draft.costs[i][j], 'la celda ' + draft.rows[i] + ' / ' + draft.columns[j], 'cell-' + i + '-' + j]);
      }
    }
  }
  const { values, scale } = decimals(entries);
  let index = 0;
  const costs = draft.costs.map((row) => row.map((value) => value === null ? null : values[index++]));
  const maximum = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  assertArithmetic(maximum * (m + n + 2) ** 2);
  return { m, n, costs, costScale: scale, maximum };
}
