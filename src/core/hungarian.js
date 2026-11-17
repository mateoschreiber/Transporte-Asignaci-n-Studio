import { copyMatrix, sum } from './input.js';
import { checkAssignment, realPairs } from './assignment-model.js';

export function maximumMatching(matrix, allowed) {
  const n = matrix.length;
  const columns = Array(n).fill(-1);
  function augment(i, seen) {
    for (let j = 0; j < n; j++) {
      if (seen[j] || !allowed(matrix[i][j], i, j)) continue;
      seen[j] = true;
      if (columns[j] === -1 || augment(columns[j], seen)) {
        columns[j] = i;
        return true;
      }
    }
    return false;
  }
  let size = 0;
  for (let i = 0; i < n; i++) if (augment(i, Array(n).fill(false))) size++;
  const rows = Array(n).fill(-1);
  columns.forEach((i, j) => {
    if (i >= 0) rows[i] = j;
  });
  return { rows, columns, size };
}

export function coverZeros(matrix) {
  const matching = maximumMatching(matrix, (value) => value === 0);
  const queue = matching.rows.flatMap((j, i) => j < 0 ? [i] : []);
  const seenRows = new Set(queue);
  const seenColumns = new Set();
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    matrix[i].forEach((cost, j) => {
      if (cost !== 0 || matching.rows[i] === j || seenColumns.has(j)) return;
      seenColumns.add(j);
      const paired = matching.columns[j];
      if (paired >= 0 && !seenRows.has(paired)) {
        seenRows.add(paired);
        queue.push(paired);
      }
    });
  }
  const rows = matrix.map((_, i) => !seenRows.has(i));
  const columns = matrix.map((_, j) => seenColumns.has(j));
  if (!validCover(matrix, rows, columns, matching.size)) throw new Error('La cobertura de ceros no es mínima.');
  return { rows, columns, matching };
}

export function validCover(matrix, rows, columns, size) {
  return rows.filter(Boolean).length + columns.filter(Boolean).length === size &&
    matrix.every((row, i) => row.every((value, j) => value !== 0 || rows[i] || columns[j]));
}

export function reduction(matrix, axis, index) {
  const line = axis === 'row' ? matrix[index] : matrix.map((row) => row[index]);
  const minimum = Math.min(...line.filter((value) => value !== null));
  if (!Number.isFinite(minimum)) throw new Error('No hay valores permitidos para reducir la línea.');
  const after = matrix.map((row, i) => row.map((value, j) =>
    value === null || (axis === 'row' ? i : j) !== index ? value : value - minimum));
  return { kind: 'reduction', axis, index, minimum, before: matrix, after };
}

export function hungarianAdjustment(matrix, rows, columns) {
  let minimum = Infinity;
  matrix.forEach((row, i) => row.forEach((value, j) => {
    if (value !== null && !rows[i] && !columns[j]) minimum = Math.min(minimum, value);
  }));
  if (!Number.isFinite(minimum) || minimum <= 0) throw new Error('No existe un ajuste positivo para la cobertura.');
  const after = matrix.map((row, i) => row.map((value, j) => {
    if (value === null) return null;
    if (!rows[i] && !columns[j]) return value - minimum;
    if (rows[i] && columns[j]) return value + minimum;
    return value;
  }));
  return { kind: 'adjustment', before: matrix, after, rows, columns, minimum };
}

export function solveHungarian(model) {
  let matrix = copyMatrix(model.working);
  const n = model.size;
  const steps = [{ kind: 'assignment-balance', after: model.original }];
  const allowed = maximumMatching(model.original, (value) => value !== null);
  if (allowed.size < n) return {
    status: 'infeasible', steps: [...steps, { kind: 'assignment-infeasible', after: model.original, matching: allowed }]
  };
  if (model.objective === 'max') steps.push({ kind: 'assignment-max', before: model.original, after: matrix });
  const u = Array(n).fill(0);
  const v = Array(n).fill(0);
  for (const [axis, dual] of [['row', u], ['column', v]]) for (let i = 0; i < n; i++) {
    const step = reduction(matrix, axis, i);
    dual[i] += step.minimum;
    steps.push(step);
    matrix = step.after;
  }
  while (true) {
    const cover = coverZeros(matrix);
    steps.push({ kind: 'cover', before: matrix, after: matrix, ...cover });
    if (cover.matching.size === n) {
      const matching = cover.matching.rows;
      const pairs = realPairs(model, matching);
      const check = checkAssignment(model, pairs);
      const transformed = matching.reduce((total, j, i) => total + model.working[i][j], 0);
      const dual = sum(u) + sum(v);
      if (!check.ok || dual !== transformed ||
          matrix.some((row, i) => row.some((value, j) => value !== null &&
            (value < 0 || value !== model.working[i][j] - u[i] - v[j])))) {
        throw new Error('La asignación no satisface el certificado del método Húngaro.');
      }
      const alternative = findAlternative(model, matrix, pairs);
      const certificate = {
        kind: 'assignment-optimal', after: matrix, matching, pairs, z: check.z,
        transformed, dual, alternative
      };
      return { status: 'optimal', steps: [...steps, certificate], z: check.z, pairs, alternative };
    }
    const adjustment = hungarianAdjustment(matrix, cover.rows, cover.columns);
    cover.rows.forEach((covered, i) => { if (!covered) u[i] += adjustment.minimum; });
    cover.columns.forEach((covered, j) => { if (covered) v[j] -= adjustment.minimum; });
    steps.push(adjustment);
    matrix = adjustment.after;
  }
}

function findAlternative(model, matrix, pairs) {
  for (const pair of pairs) {
    const matching = maximumMatching(matrix, (value, i, j) => value === 0 && (i !== pair.i || j !== pair.j));
    if (matching.size === model.size) return realPairs(model, matching.rows);
  }
  return null;
}
