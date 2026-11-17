import { grid, parseCosts } from './input.js';

export function assignmentModel(draft) {
  const { m, n, costs, costScale } = parseCosts(draft);
  const size = Math.max(m, n);
  const objective = draft.objective === 'max' ? 'max' : 'min';
  const original = grid(size, size, null);
  const rows = draft.rows.map((label, i) => label.trim() || 'Fila ' + (i + 1));
  const columns = draft.columns.map((label, j) => label.trim() || 'Columna ' + (j + 1));
  for (let i = m; i < size; i++) rows.push('Fila ficticia ' + (i - m + 1));
  for (let j = n; j < size; j++) columns.push('Columna ficticia ' + (j - n + 1));
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    if (i < m && j < n) original[i][j] = costs[i][j];
    else if (i >= m ? !draft.requiredColumns?.[j] : !draft.requiredRows?.[i]) original[i][j] = 0;
  }
  const allowed = original.flat().filter((value) => value !== null);
  const maximum = objective === 'max' && allowed.length ? Math.max(...allowed) : null;
  const working = maximum === null ? original : original.map((row) =>
    row.map((value) => value === null ? null : maximum - value));
  return {
    m, n, size, rows, columns, original, working, objective, maximum, costScale,
    requiredRows: Array.from({ length: m }, (_, i) => m <= n || Boolean(draft.requiredRows?.[i])),
    requiredColumns: Array.from({ length: n }, (_, j) => n <= m || Boolean(draft.requiredColumns?.[j]))
  };
}

export function realPairs(model, matching) {
  return matching.flatMap((j, i) => i < model.m && j >= 0 && j < model.n ? [{ i, j }] : []);
}

export function checkAssignment(model, pairs) {
  const issues = [];
  const usedRows = new Set();
  const usedColumns = new Set();
  let z = 0;
  for (const { i, j } of pairs) {
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || i >= model.m || j < 0 || j >= model.n) {
      issues.push('Hay una pareja fuera de la matriz original.');
      continue;
    }
    if (usedRows.has(i)) issues.push('La fila ' + model.rows[i] + ' tiene más de una pareja.');
    if (usedColumns.has(j)) issues.push('La columna ' + model.columns[j] + ' tiene más de una pareja.');
    usedRows.add(i);
    usedColumns.add(j);
    const value = model.original[i][j];
    if (value === null) issues.push('Pareja prohibida: ' + model.rows[i] + ' / ' + model.columns[j] + '.');
    else z += value;
  }
  for (let i = 0; i < model.m; i++) {
    if (model.requiredRows[i] && !usedRows.has(i)) issues.push('Falta cubrir ' + model.rows[i] + '.');
  }
  for (let j = 0; j < model.n; j++) {
    if (model.requiredColumns[j] && !usedColumns.has(j)) issues.push('Falta cubrir ' + model.columns[j] + '.');
  }
  return { ok: issues.length === 0, z: issues.length ? null : z, issues };
}
