import { el, number } from './dom.js';
import { matrixTable } from './table.js';
import { operation } from './trace.js';

export function assignmentTable(model, matrix, options = {}) {
  const { located, rows, columns, matching, uncovered, zeros = true, choose } = options;
  const usesCell = (i, j) => located && (located.axis === 'row' ? located.index === i : located.index === j);
  return matrixTable(model.rows, model.columns, (i, j) => {
    const value = matrix[i][j];
    const paired = matching?.[i] === j;
    const label = value === null ? 'Prohibida' : number(value, model.costScale);
    const content = el('span', { class: 'assignment-value' },
      paired && el('span', { class: 'pair-check', 'aria-label': 'Asignada' }, '✓ '),
      value === null ? el('span', { 'aria-label': label }, '×') : label);
    return choose && value !== null ?
      el('button', { type: 'button', class: 'pick-cell', 'aria-pressed': String(Boolean(paired)),
        'aria-label': 'Pareja ' + model.rows[i] + ' / ' + model.columns[j] + ', valor ' + label,
        onClick: () => choose(i, j) }, content) : content;
  }, {
    label: 'Tabla de Asignación', rowPrefix: 'Fila / columna',
    rowClass: (i) => (rows?.[i] ? 'line-row-heading' : '') + (located?.axis === 'row' && located.index === i ? ' active-line' : ''),
    columnClass: (j) => (columns?.[j] ? 'line-column-heading' : '') + (located?.axis === 'column' && located.index === j ? ' active-line' : ''),
    cellClass: (i, j) => [
      matrix[i][j] === null ? 'blocked' : '',
      matching?.[i] === j || (located?.phase !== 'after' && usesCell(i, j) && matrix[i][j] === located.minimum) ? 'active-cell' : '',
      usesCell(i, j) ? 'candidate' : '',
      rows?.[i] ? 'line-row' : '',
      columns?.[j] ? 'line-column' : '',
      zeros && matrix[i][j] === 0 ? 'zero-cell' : '',
      uncovered !== undefined && !rows[i] && !columns[j] && matrix[i][j] === uncovered ? 'uncovered' : ''
    ].join(' ')
  });
}

export function assignmentShape(model) {
  if (model.m === model.n) return 'La matriz ya es cuadrada. Cada fila y cada columna requiere una pareja.';
  const count = model.size - Math.min(model.m, model.n);
  return 'Se agrega(n) ' + count + (model.m < model.n ? ' fila(s) ficticia(s). Su pareja señala una columna sin cubrir.' :
    ' columna(s) ficticia(s). Su pareja señala una fila disponible.');
}

function pairsTable(model, pairs) {
  const rows = new Set(pairs.map(({ i }) => i));
  const columns = new Set(pairs.map(({ j }) => j));
  return el('div', { class: 'stack' },
    el('ul', { class: 'pair-list' }, pairs.map(({ i, j }) => el('li', {},
      model.rows[i] + ' → ' + model.columns[j], el('strong', {}, number(model.original[i][j], model.costScale))))),
    model.rows.slice(0, model.m).some((_, i) => !rows.has(i)) && el('p', { class: 'dim' },
      'Filas sin pareja real: ' + model.rows.slice(0, model.m).filter((_, i) => !rows.has(i)).join(', ') + '.'),
    model.columns.slice(0, model.n).some((_, j) => !columns.has(j)) && el('p', { class: 'dim' },
      'Columnas sin pareja real: ' + model.columns.slice(0, model.n).filter((_, j) => !columns.has(j)).join(', ') + '.'));
}

export function assignmentStep(model, step) {
  const fmt = (value) => number(value, model.costScale);
  const total = step.z === undefined ? '' : fmt(step.z);
  const values = (matrix, options) => assignmentTable(model, matrix, options);
  if (step.kind === 'assignment-balance') return el('div', { class: 'step-grid' },
    values(step.after, { zeros: false }), operation('Verificar y balancear', assignmentShape(model),
      model.m + ' × ' + model.n + ' → ' + model.size + ' × ' + model.size,
      'Cada pareja ficticia permitida tiene valor original cero.', 'Siguiente: verificar las parejas permitidas y preparar la reducción.'));
  if (step.kind === 'assignment-infeasible') return el('div', { class: 'step-grid' },
    values(step.after, { matching: step.matching.rows }),
    operation('Asignación infactible', 'Las parejas permitidas no alcanzan para cubrir todos los elementos obligatorios.',
      'Emparejamiento máximo: ' + step.matching.size + ' < ' + model.size,
      'Revisa las prohibiciones y los elementos marcados como obligatorios.'));
  if (step.kind === 'assignment-max') {
    let example;
    model.original.some((row, i) => row.some((value, j) => {
      if (value === null) return false;
      example = fmt(model.maximum) + ' − (' + fmt(value) + ') = ' + fmt(step.after[i][j]);
      return true;
    }));
    return el('div', { class: 'step-grid' }, values(step.after),
      operation('Convertir beneficios a costos', 'Todas las asignaciones completas contienen el mismo número de parejas. Restar los beneficios de una constante las ordena en sentido inverso.',
        'Cᵢⱼ = Bmáx − Bᵢⱼ. Ejemplo: ' + example,
        'La solución final se evalúa sumando los beneficios de la matriz original.', 'Siguiente: reducir las filas.'),
      el('details', {}, el('summary', {}, 'Ver matriz de beneficios'), values(step.before, { zeros: false })));
  }
  if (step.kind === 'reduction') {
    const name = step.axis === 'row' ? model.rows[step.index] : model.columns[step.index];
    const line = step.axis === 'row' ? 'fila' : 'columna';
    const previous = (step.axis === 'row' ? step.before[step.index] : step.before.map((row) => row[step.index]))
      .filter((value) => value !== null);
    const operands = previous.length <= 10 ? previous.map(fmt).join(', ') : 'valores permitidos de la ' + line;
    return el('div', { class: 'step-grid' }, values(step.after, { located: { ...step, phase: 'after' } }),
      operation('Reducir ' + line + ' · ' + name, 'Restar el mínimo de una línea preserva el orden de las asignaciones completas y crea al menos un cero.',
        'mín(' + operands + ') = ' + fmt(step.minimum) + '. Restar ' + fmt(step.minimum) + ' en esa ' + line + '.',
        'La matriz muestra los valores después de la resta.', 'Siguiente: procesar la siguiente línea o cubrir ceros.'),
      el('details', {}, el('summary', {}, 'Ver matriz antes de reducir'), values(step.before, { located: step })));
  }
  if (step.kind === 'cover') {
    const count = step.matching.size;
    const covered = [
      ...model.rows.filter((_, i) => step.rows[i]).map((name) => 'fila ' + name),
      ...model.columns.filter((_, j) => step.columns[j]).map((name) => 'columna ' + name)
    ];
    return el('div', { class: 'step-grid' }, values(step.after, { ...step, matching: step.matching.rows }),
      operation('Cubrir los ceros', 'La cobertura mínima tiene tantas líneas como ceros independientes en un emparejamiento máximo.',
        'Líneas = ' + count + ' · Orden de la matriz = ' + model.size,
        covered.length ? 'Líneas: ' + covered.join(', ') + '.' : 'Todavía no hay ceros.',
        count === model.size ? 'Siguiente: leer las parejas y calcular el objetivo original.' :
          'Siguiente: buscar el menor valor permitido que quedó sin cubrir.'));
  }
  if (step.kind === 'adjustment') return el('div', { class: 'step-grid' },
    values(step.after, { rows: step.rows, columns: step.columns }),
    operation('Ajustar la matriz', 'Se crean nuevos ceros restando el mínimo sin cubrir. Se suma el mismo valor en las intersecciones de dos líneas.',
      'δ = ' + fmt(step.minimum) + '. Descubierta: −δ. Dos líneas: +δ. Una línea: sin cambio.',
      '× indica una pareja prohibida.',
      'Siguiente: volver a cubrir los ceros.'),
    el('details', {}, el('summary', {}, 'Ver el mínimo antes del ajuste'),
      values(step.before, { rows: step.rows, columns: step.columns, uncovered: step.minimum })));
  const terms = step.pairs.map(({ i, j }) => fmt(model.original[i][j]));
  return el('div', { class: 'step-grid' }, values(step.after, { matching: step.matching }),
    el('div', { class: 'stack' },
      operation('Asignación óptima', 'Hay un cero independiente en cada fila y columna del modelo cuadrado.',
        'Z = ' + terms.join(' + ').replaceAll(' + -', ' − ') + ' = ' + total,
        step.alternative ? 'Existe otra asignación óptima con parejas reales distintas.' : 'Las parejas reales del óptimo son únicas.'),
      pairsTable(model, step.pairs)),
    step.alternative && el('details', { class: 'alternative' }, el('summary', {}, 'Ver otra asignación óptima'),
      pairsTable(model, step.alternative)));
}
