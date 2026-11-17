import { el, number } from './dom.js';

export function matrixTable(rows, columns, value, options = {}) {
  const { tailColumn, tailRow, className = '', label = 'Matriz', rowClass, columnClass, cellClass, rowPrefix = 'Fila' } = options;
  const heading = el('tr', {}, el('th', { scope: 'col', class: 'corner' }, rowPrefix),
    columns.map((column, j) => el('th', { scope: 'col', class: columnClass?.(j) }, column)),
    tailColumn && el('th', { scope: 'col', class: 'margin' }, tailColumn.label));
  const body = el('tbody', {}, rows.map((row, i) =>
    el('tr', {}, el('th', { scope: 'row', class: rowClass?.(i) }, row),
      columns.map((_, j) => el('td', { class: cellClass?.(i, j), 'data-cell': i + '-' + j }, value(i, j))),
      tailColumn && el('td', { class: 'margin' }, tailColumn.values[i]))));
  const footer = tailRow && el('tfoot', {}, el('tr', {}, el('th', { scope: 'row', class: 'margin' }, tailRow.label),
    tailRow.values.map((amount) => el('td', { class: 'margin' }, amount)),
    tailColumn && el('td', { class: 'margin' }, '∑')));
  return el('div', { class: 'matrix-scroll ' + className, tabindex: '0', 'aria-label': label, role: 'region' },
    el('table', { class: 'matrix', 'aria-label': label }, el('thead', {}, heading), body, footer));
}

export function sourceMatrix(draft) {
  const options = { label: 'Datos del ejercicio', cellClass: (i, j) => draft.costs[i][j] === null ? 'blocked' : '' };
  if (draft.topic === 'transport') {
    options.tailColumn = { label: 'Sᵢ', values: draft.supply.map((v) => number(v, 1)) };
    options.tailRow = { label: 'Dⱼ', values: draft.demand.map((v) => number(v, 1)) };
  }
  return matrixTable(draft.rows, draft.columns, (i, j) =>
    draft.costs[i][j] === null ? el('span', { 'aria-label': 'Prohibida' }, '×') :
      String(draft.costs[i][j]).replace('.', ','), options);
}
