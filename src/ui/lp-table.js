import { operation } from './trace.js';
import { button, el } from './dom.js';
import { formatRational as f, subtract } from '../core/rational.js';
import { dot } from '../core/lp.js';

function symbolic(m, value) {
  return m?.numerator ? f(m) + 'M' + (value.numerator ? ' + (' + f(value) + ')' : '') : f(value);
}

export function simplexTable(step) {
  const { rows, columns, basis, costs, penalties, zj, mj, reduced, mr, entering, leaving, ratios } = step;
  const explanation = el('p', { class: 'formula', role: 'status' }, 'Selecciona una celda para inspeccionar su cálculo.');
  const header = (items) => el('tr', {}, items.map((value) => el('th', {}, value)));
  const inspect = (label, value, formula) => button(value, () => { explanation.textContent = formula; },
    { class: 'pick-cell', 'aria-label': label + ', ' + value });
  const summary = (name, entries, m) => el('tr', {}, el('th', { scope: 'row' }, name), el('td'), el('td'),
    entries.map((value, j) => {
      const label = name + ' de ' + columns[j].name;
      const shown = symbolic(m[j], value);
      let formula = label + ' = ' + shown;
      if (name === 'Zj') {
        const operands = rows.map((row, i) => {
          const basic = basis[i];
          return '(' + symbolic(penalties[basic], costs[basic]) + ') × (' + f(row.values[j]) + ')';
        });
        formula = label + ' = ' + (operands.join(' + ') || '0') + ' = ' + shown;
      } else if (name === 'Zj−Cj') {
        formula = label + ' = (' + symbolic(mj[j], zj[j]) + ') − (' + symbolic(penalties[j], costs[j]) + ') = ' + shown;
      }
      return el('td', {}, inspect(label, shown, formula));
    }), el('td'));
  const head = el('thead', {},
    costs && summary('Cj', costs, penalties),
    header(['Ck', 'Xk / Yk', 'Bk', ...columns.map(({ name }) => name), step.before ? 'Oi / θi antes' : 'Oi / θi']));
  const body = el('tbody', {}, rows.map((row, i) => {
    const basic = basis[i];
    const bound = f(row.bound);
    const prior = step.before?.[i];
    const updatedBound = prior && (i === leaving
      ? f(prior.bound) + ' ÷ ' + f(step.pivotValue) + ' = ' + bound
      : f(prior.bound) + ' − (' + f(prior.values[entering]) + ') × (' + f(step.normalized.bound) + ') = ' + bound);
    const ratio = ratios?.[i];
    const ratioRow = prior ?? row;
    const ratioText = ratio && f(ratio);
    return el('tr', {}, el('th', { scope: 'row' }, costs ? symbolic(penalties[basic], costs[basic]) : '—'),
      el('td', {}, columns[basic].name), el('td', {}, inspect('Bk de ' + row.id, bound, updatedBound || row.id + ' · Bk = ' + bound)),
      row.values.map((value, j) => el('td', { class: i === leaving || j === entering ? 'candidate' : '' },
        button(f(value), () => {
          if (step.before) {
            const previous = step.before[i].values[j];
            explanation.textContent = i === leaving
              ? f(previous) + ' ÷ ' + f(step.pivotValue) + ' = ' + f(value)
              : f(previous) + ' − (' + f(step.before[i].values[entering]) + ') × (' + f(step.normalized.values[j]) + ') = ' + f(value);
          } else explanation.textContent = row.id + ', columna ' + columns[j].name + ' = ' + f(value);
        }, { class: 'pick-cell', 'aria-label': row.id + ', ' + columns[j].name + ', ' + f(value) }))),
      el('td', {}, ratios ? inspect('Cociente de ' + row.id, ratioText || 'Descartado',
        ratio ? f(ratioRow.bound) + ' ÷ ' + f(ratioRow.values[entering]) + ' = ' + ratioText
          : 'Se descarta el denominador ' + f(ratioRow.values[entering]) + ' porque es menor o igual a cero.') : '—'));
  }));
  return el('div', { class: 'stack' }, el('div', { class: 'matrix-scroll', tabindex: '0', role: 'region', 'aria-label': 'Tabla Simplex' },
    el('table', { class: 'matrix' }, head, body, zj && el('tfoot', {}, summary('Zj', zj, mj), summary('Zj−Cj', reduced, mr)))),
  explanation);
}

export function simplexStep(step) {
  if (step.kind === 'pivot') {
    const reduce = (costs) => step.columns.map((_, j) =>
      dot(step.basis.map((index) => costs[index]), step.rows.map(({ values }) => values[j])));
    const zj = reduce(step.costs);
    const mj = reduce(step.penalties);
    step = { ...step, zj, mj,
      reduced: zj.map((value, j) => subtract(value, step.costs[j])),
      mr: mj.map((value, j) => subtract(value, step.penalties[j])),
      value: dot(step.basis.map((index) => step.costs[index]), step.rows.map(({ bound }) => bound)) };
  }
  const headings = { standard: 'Forma estándar', table: 'Costos reducidos y cocientes', pivot: 'Operación de pivoteo',
    cleanup: 'Retirar artificial básica', remove: 'Retirar igualdad dependiente' };
  const label = step.phase ? 'Fase ' + (step.phase === 1 ? 'I · M simbólica' : 'II · Objetivo original') : '';
  let detail = 'Se incorporan holguras, excesos o artificiales según el operador.';
  if (step.kind === 'remove') detail = 'La fila ' + step.id + ' se reduce a una igualdad nula al eliminar artificiales.';
  if (step.kind === 'table') detail = 'Zj = Σ Ck·akj. Solo se divide Bk entre coeficientes positivos de la entrante.';
  if (step.kind === 'pivot' || step.kind === 'cleanup') detail = 'Entra ' + step.columns[step.entering].name +
    '. Se divide la fila ' + (step.leaving + 1) + ' entre ' + f(step.pivotValue) + ' y se elimina la entrante de las demás filas.';
  return el('div', { class: 'stack' }, operation(headings[step.kind], detail, label,
    step.value && 'Z de las variables originales = ' + f(step.value)),
  step.kind === 'standard' && el('ul', {}, [
    ...step.rows.filter(({ reverse }) => reverse).map((row) =>
      el('li', {}, row.id + ' · se multiplica la fila por −1 y se conserva la equivalencia de la ligadura.')),
    ...step.columns.filter(({ sign }) => sign?.numerator < 0n).map(({ name }) =>
      el('li', {}, name.endsWith('−') ? name.slice(0, -1) + ' = ' + name.slice(0, -1) + '+ − ' + name
        : name + ' se reconstruye como el opuesto de la variable no negativa de la tabla.'))
  ]), step.rows && simplexTable(step));
}
