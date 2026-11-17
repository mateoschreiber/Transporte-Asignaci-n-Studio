import { MAX_DIMENSION } from '../core/input.js';
import { announce, button, el } from './dom.js';

export function editMatrix(draft, update, rebuild) {
  const isTransport = draft.topic === 'transport';
  const m = draft.rows.length;
  const n = draft.columns.length;
  let blockMode = false;
  const table = el('table', { class: 'matrix editor-table' });
  const textInput = (value, label, change, attrs = {}) => el('input', {
    type: 'text', 'aria-label': label, maxLength: 60, ...attrs, value,
    onInput: (event) => { change(event.target.value); update(); }
  });
  const metric = (value, label, change, id) => textInput(value, label, change, { inputmode: 'decimal', maxlength: 24, id });
  const header = el('tr', {}, el('th', { scope: 'col', class: 'corner' }, isTransport ? 'Origen / destino' : 'Fila / columna'));
  for (let j = 0; j < n; j++) {
    header.append(el('th', { scope: 'col' },
      textInput(draft.columns[j], 'Nombre de columna ' + (j + 1), (value) => { draft.columns[j] = value; })));
  }
  if (isTransport) header.append(el('th', { scope: 'col', class: 'margin' }, 'Oferta Sᵢ'));
  table.append(el('thead', {}, header));
  const body = el('tbody');
  table.append(body);
  const cells = [];
  const savedCosts = new Map();
  function redrawCell(i, j) {
    const container = cells[i][j];
    const label = 'Costo fila ' + (i + 1) + ', columna ' + (j + 1);
    const value = draft.costs[i][j];
    const id = 'cell-' + i + '-' + j;
    container.classList.toggle('blocked', value === null);
    if (blockMode || value === null) {
      container.replaceChildren(button(value === null ? '×' : (value === '' ? '·' : String(value)), () => {
        if (value === null) draft.costs[i][j] = savedCosts.get(id) ?? '';
        else {
          savedCosts.set(id, value);
          draft.costs[i][j] = null;
        }
        redrawCell(i, j);
        container.firstElementChild.focus();
        announce(draft.costs[i][j] === null ? 'Celda prohibida.' : 'Celda habilitada.');
        update();
      }, { class: 'cell-toggle', id, 'aria-label': (value === null ? 'Habilitar ' : 'Prohibir ') + label.toLowerCase() }));
    } else {
      container.replaceChildren(metric(value, label, (next) => { draft.costs[i][j] = next; }, id));
    }
  }
  for (let i = 0; i < m; i++) {
    const row = el('tr', {}, el('th', { scope: 'row' },
      textInput(draft.rows[i], 'Nombre de fila ' + (i + 1), (value) => { draft.rows[i] = value; })));
    cells[i] = [];
    for (let j = 0; j < n; j++) {
      const cell = el('td');
      cells[i].push(cell);
      row.append(cell);
      redrawCell(i, j);
    }
    if (isTransport) row.append(el('td', { class: 'margin' }, metric(draft.supply[i], 'Oferta de fila ' + (i + 1),
      (value) => { draft.supply[i] = value; }, 'supply-' + i)));
    body.append(row);
  }
  if (isTransport) {
    const footer = el('tr', {}, el('th', { scope: 'row', class: 'margin' }, 'Demanda Dⱼ'));
    for (let j = 0; j < n; j++) footer.append(el('td', { class: 'margin' },
      metric(draft.demand[j], 'Demanda de columna ' + (j + 1), (value) => { draft.demand[j] = value; }, 'demand-' + j)));
    footer.append(el('td', { class: 'margin' }, '∑'));
    table.append(el('tfoot', {}, footer));
  }

  function resize(axis, add) {
    const isRow = axis === 'rows';
    const labels = draft[axis];
    if (add) {
      labels.push((isRow ? 'Fila ' : 'Columna ') + (labels.length + 1));
      if (isRow) draft.costs.push(Array(n).fill(''));
      else draft.costs.forEach((row) => row.push(''));
    } else {
      labels.pop();
      if (isRow) {
        draft.costs.pop();
        if (draft.fictitiousRow === labels.length) delete draft.fictitiousRow;
      } else draft.costs.forEach((row) => row.pop());
    }
    const values = isTransport ? (isRow ? draft.supply : draft.demand) :
      draft[isRow ? 'requiredRows' : 'requiredColumns'];
    if (values) {
      if (add) values.push(isTransport ? '' : false);
      else values.pop();
    }
    rebuild((isRow ? 'filas' : 'columnas') + '-' + (add ? 'add' : 'remove'));
  }
  const size = (axis, count, label) => el('div', { class: 'dimension' },
    button('−', () => resize(axis, false), { id: label + '-remove', disabled: count === 1, 'aria-label': 'Quitar última ' + (axis === 'rows' ? 'fila' : 'columna') }),
    el('span', {}, count + ' ' + label),
    button('+', () => resize(axis, true), { id: label + '-add', disabled: count === MAX_DIMENSION, 'aria-label': 'Agregar ' + (axis === 'rows' ? 'fila' : 'columna') }));

  const block = button(isTransport ? 'Editar rutas prohibidas' : 'Editar parejas prohibidas', () => {
    blockMode = !blockMode;
    block.setAttribute('aria-pressed', String(blockMode));
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) redrawCell(i, j);
    announce(blockMode ? 'Selecciona una celda para alternar su prohibición.' : 'Edición numérica habilitada.');
  }, { class: 'small-button', 'aria-pressed': 'false' });
  return el('div', { class: 'matrix-editor' },
    el('div', { class: 'matrix-toolbar' }, size('rows', m, 'filas'), size('columns', n, 'columnas'), block),
    el('div', { class: 'matrix-scroll', tabindex: '0', 'aria-label': 'Matriz editable' }, table));
}
