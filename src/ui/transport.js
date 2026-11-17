import { el, number } from './dom.js';
import { matrixTable } from './table.js';
import { operation } from './trace.js';
import { methodNames } from '../data/exercises.js';

const qty = (model, value) => number(value, model.quantityScale);
const money = (model, value) => number(value, model.costScale);
const total = (model, value) => number(value, model.objectiveScale);
const ref = (i, j) => 'X(' + (i + 1) + ',' + (j + 1) + ')';
const route = (model, i, j) => model.rows[i] + ' → ' + model.columns[j];
const blocked = () => el('span', { 'aria-label': 'Prohibida' }, '×');

export function balanceText(model) {
  if (!model.fictitious) return 'La oferta total coincide con la demanda total.';
  const { axis, amount, embedded } = model.fictitious;
  const units = qty(model, amount);
  if (axis === 'row') return (embedded ? 'El origen ficticio del modelo aporta ' : 'Se agrega un origen ficticio con ') +
    units + ' unidades. Sus asignaciones representan demanda sin cobertura real.';
  return 'Se agrega un destino ficticio con ' + units + ' unidades. Sus asignaciones representan oferta sin utilizar.';
}

export function transportSummary(model) {
  const k = model.fictitious;
  const realSupply = model.totalSupply - (k?.embedded ? k.amount : 0);
  const summary = [
    ['Oferta real', qty(model, realSupply)], ['Demanda', qty(model, model.totalDemand)],
    ['Oferta − demanda', qty(model, realSupply - model.totalDemand)]
  ];
  return el('div', { class: 'stack' },
    el('dl', { class: 'totals' }, summary.map(([label, value]) =>
      el('div', {}, el('dt', {}, label), el('dd', {}, value)))),
    el('p', { class: 'status ' + (model.fictitious ? 'caution' : '') }, balanceText(model)),
    el('details', {}, el('summary', {}, 'Función objetivo y restricciones'), formulation(model)));
}

function formulation(model) {
  const terms = [];
  const constraints = [];
  const top = model.m * model.n <= 80;
  if (top) {
    model.costs.forEach((row, i) => row.forEach((cost, j) => {
      if (cost !== null) terms.push(money(model, cost) + '·' + ref(i, j));
      else constraints.push(ref(i, j) + ' = 0 (prohibida)');
    }));
  }
  return el('div', { class: 'formulation' },
    el('p', { class: 'formula' }, 'Min Z = ' + (top ? (terms.join(' + ').replaceAll(' + -', ' − ') || '0') : 'Σᵢ Σⱼ Cᵢⱼ Xᵢⱼ')),
    el('p', {}, 'Restricciones del modelo balanceado'),
    el('ul', {},
      model.rows.map((row, i) => el('li', {}, row + ': Σⱼ X(' + (i + 1) + ',j) = ' + qty(model, model.supply[i]))),
      model.columns.map((col, j) => el('li', {}, col + ': Σᵢ X(i,' + (j + 1) + ') = ' + qty(model, model.demand[j]))),
      el('li', {}, 'X(i,j) ≥ 0. Las rutas prohibidas cumplen X(i,j) = 0.'),
      constraints.map((text) => el('li', {}, text))));
}

export function balanceStep(model) {
  return { kind: 'balance', model };
}

export function transportTable(model, state, options = {}) {
  const {
    selection, cycle = [], reduced, scores, rowHeaders, columnHeaders, choose, disableQuantities, showRole,
    active = [], animateMargins = false
  } = options;
  const cycleAt = new Map(cycle.map((cell) => [cell.i + '-' + cell.j, cell.sign]));
  const directions = new Map();
  const drawn = new Map();
  for (let cursor = 0; cursor < cycle.length; cursor++) {
    const from = cycle[cursor];
    const to = cycle[(cursor + 1) % cycle.length];
    const di = Math.sign(to.i - from.i);
    const dj = Math.sign(to.j - from.j);
    directions.set(from.i + '-' + from.j, di ? (di > 0 ? '↓' : '↑') : (dj > 0 ? '→' : '←'));
    for (let i = from.i + di, j = from.j + dj; i !== to.i || j !== to.j; i += di, j += dj) {
      drawn.set(i + '-' + j, di ? 'cycle-vertical' : 'cycle-horizontal');
    }
  }
  const highlight = new Set(active.map((cell) => cell.i + '-' + cell.j));
  const selected = (i, j) => selection?.i === i && selection?.j === j;
  const display = (i, j) => {
    const cost = model.costs[i][j];
    if (cost === null) return blocked();
    const units = state?.allocation[i][j] ?? 0;
    const basic = state?.basis?.[i][j];
    const reducedValue = reduced?.[i][j];
    const score = scores?.[i][j];
    const sign = cycleAt.get(i + '-' + j);
    const value = el('div', { class: 'cell-values' },
      el('small', { class: 'unit-cost' }, (state && !disableQuantities ? 'c ' : '') + money(model, cost)),
      !disableQuantities && (units !== 0 || basic) && el('strong', { class: 'flow-value' }, 'x ' + qty(model, units)),
      showRole && el('small', {}, basic ? 'V.B.' : 'V.N.B.'),
      reducedValue !== null && reducedValue !== undefined && el('small', { class: reducedValue < 0 ? 'negative' : '' }, 'r ' + money(model, reducedValue)),
      score !== null && score !== undefined && el('small', {}, 'Δ ' + money(model, score)),
      sign !== undefined && el('strong', { class: 'cycle-sign' }, sign > 0 ? '+' : '−',
        el('span', { 'aria-hidden': 'true' }, ' ' + directions.get(i + '-' + j))));
    if (choose) return el('button', { type: 'button', class: 'pick-cell', onClick: () => choose(i, j),
      'aria-label': 'Seleccionar ' + route(model, i, j) + ', costo ' + money(model, cost) }, value);
    return value;
  };
  const labels = (label, extra) => el('span', {}, label, extra !== undefined && extra !== null &&
    el('small', { class: 'table-annotation' }, extra));
  const marginValue = (value, index, axis) => {
    const text = qty(model, value);
    return animateMargins && selection?.[axis] === index ? el('strong', { class: 'margin-change' }, text) : text;
  };
  return matrixTable(model.rows.map((row, i) => labels(row, rowHeaders?.[i])),
    model.columns.map((col, j) => labels(col, columnHeaders?.[j])), display, {
      label: 'Tabla de Transporte', rowPrefix: 'Origen / destino',
      tailColumn: { label: state ? 'Sᵢ pendiente' : 'Oferta Sᵢ', values: (state?.supply || model.supply).map((value, i) => marginValue(value, i, 'i')) },
      tailRow: { label: state ? 'Dⱼ pendiente' : 'Demanda Dⱼ', values: (state?.demand || model.demand).map((value, j) => marginValue(value, j, 'j')) },
      rowClass: (i) => selection?.i === i ? 'active-line' : '',
      columnClass: (j) => selection?.j === j ? 'active-line' : '',
      cellClass: (i, j) => [
        model.costs[i][j] === null ? 'blocked' : '',
        selected(i, j) ? 'active-cell' : (selection?.i === i || selection?.j === j) ? 'crosshair' : '',
        highlight.has(i + '-' + j) ? 'candidate' : '',
        cycleAt.has(i + '-' + j) ? (cycleAt.get(i + '-' + j) > 0 ? 'cycle-plus' : 'cycle-minus') : '',
        drawn.get(i + '-' + j) || ''
      ].join(' ')
    });
}

function decisionHeaders(model, decision = {}) {
  const result = { rowHeaders: [], columnHeaders: [] };
  for (const line of decision.lines || []) {
    const headers = line.axis === 'row' ? result.rowHeaders : result.columnHeaders;
    headers[line.index] = line.forced ? 'Única' : 'p ' + money(model, line.penalty);
  }
  if (decision.maxima) {
    result.rowHeaders = decision.maxima.rows.map((value) => value === null ? null : 'máx ' + money(model, value));
    result.columnHeaders = decision.maxima.columns.map((value) => value === null ? null : 'máx ' + money(model, value));
  }
  return result;
}

function allocationReason(model, step) {
  const { i, j, cost } = step.choice;
  if (step.method === 'northwest') return 'Se elige la primera ruta viable de la tabla activa, empezando arriba a la izquierda.';
  if (step.method === 'minimum') return 'El costo ' + money(model, cost) + ' es el menor entre las rutas elegibles.';
  if (step.method === 'russell') {
    const { rows, columns } = step.decision.maxima;
    return 'Russell elige el menor puntaje: ' + money(model, cost) + ' − ' + money(model, rows[i]) +
      ' − ' + money(model, columns[j]) + ' = ' + money(model, step.decision.scores[i][j]) + '.';
  }
  const line = step.decision.lines.find((item) => item.eligible && item.choices.some((cell) => cell.i === i && cell.j === j));
  return line.forced ? 'Esta línea tiene una sola ruta viable y se atiende primero.' :
    'La mayor penalización es ' + money(model, line.second) + ' − ' + money(model, line.minimum) + ' = ' +
    money(model, line.penalty) + '. En esa línea se toma la ruta de menor costo.';
}

export function transportStep(model, step) {
  if (step.kind === 'balance') return el('div', { class: 'step-grid' },
    transportTable(model),
    operation(model.fictitious ? 'Balancear el modelo' : 'Comprobar el balanceo', balanceText(model),
      'Σ Sᵢ − Σ Dⱼ = ' + qty(model, model.totalSupply) + ' − ' + qty(model, model.totalDemand) + ' = ' +
      qty(model, model.difference), 'La tabla muestra los márgenes del modelo de cálculo.', 'Siguiente: elegir una ruta elegible.'));
  if (step.kind === 'transport-infeasible') return el('div', { class: 'step-grid' },
    transportTable(model, step.before),
    operation('Modelo infactible', 'Las rutas permitidas no conectan suficientes unidades con los destinos que las necesitan.',
      'Unidades que no pueden asignarse = ' + qty(model, step.decision.unmet), 'Revisa las prohibiciones y los márgenes.'));
  if (step.kind === 'basis') return el('div', { class: 'step-grid' },
    transportTable(model, step.after, { showRole: true, active: step.added }),
    operation('Solución Básica Factible',
      step.added.length ? 'Se añaden ' + step.added.length + ' V.B. de valor cero para completar la base sin formar ciclos.' :
        'Todas las ofertas y demandas se conservaron y las celdas básicas forman una base acíclica.',
      'Z = Σ Cᵢⱼ Xᵢⱼ = ' + total(model, step.after.z),
      'Costo de la SBF inicial: ' + total(model, step.after.z) + '.',
      'Usa MODI para comprobar la optimalidad.'));
  if (step.kind === 'allocation') {
    const { i, j, cost, bound, quantity } = step.choice;
    const { before, after } = step;
    const reason = allocationReason(model, step) +
      (quantity < bound ? ' Las rutas prohibidas obligan a reservar capacidad para otros destinos.' : '');
    const calc = ref(i, j) + ' = ' + (quantity === bound ? 'mín(' + qty(model, before.supply[i]) + ', ' +
      qty(model, before.demand[j]) + ') = ' : 'máximo viable = ') + qty(model, quantity);
    return el('div', { class: 'step-grid' },
      transportTable(model, after, { ...decisionHeaders(model, step.decision), selection: step.choice,
        scores: step.decision.scores, animateMargins: true }),
      operation(methodNames[step.method] + ' · ' + route(model, i, j), reason, calc +
        ' · ΔZ = ' + money(model, cost) + ' × ' + qty(model, quantity) + ' = ' + total(model, step.delta),
      'Oferta: ' + qty(model, before.supply[i]) + ' → ' + qty(model, after.supply[i]) +
        '. Demanda: ' + qty(model, before.demand[j]) + ' → ' + qty(model, after.demand[j]) +
        '. Z: ' + total(model, before.z) + ' → ' + total(model, after.z) + '.',
      'Siguiente: actualizar las rutas elegibles con los saldos de la tabla.'));
  }
  return modiStep(model, step);
}

export function transportDecisionTable(model, state, decision, choose, revealCalculations = true) {
  return transportTable(model, state, {
    ...(revealCalculations ? decisionHeaders(model, decision) : {}),
    scores: revealCalculations ? decision?.scores : undefined, choose
  });
}

function modiStep(model, step) {
  const { before, after, potentials, reduced, choice, cycle = [] } = step;
  const options = {
    rowHeaders: potentials?.rows.map((v) => 'U ' + money(model, v)),
    columnHeaders: potentials?.columns.map((v) => 'V ' + money(model, v)),
    reduced, selection: choice, cycle, showRole: true
  };
  if (step.kind === 'potentials') {
    const equations = step.equations.map(({ i, j, axis }) => (axis === 'row' ? 'U' + (i + 1) : 'V' + (j + 1)) +
      ' = ' + money(model, model.costs[i][j]) + ' − ' +
      money(model, axis === 'row' ? potentials.columns[j] : potentials.rows[i]) + ' = ' +
      money(model, axis === 'row' ? potentials.rows[i] : potentials.columns[j]));
    return el('div', { class: 'step-grid' }, transportTable(model, before, options),
      operation('Calcular Uᵢ y Vⱼ', 'Se fija un potencial en cero por componente. Las V.B. determinan el resto.',
        'Uᵢ + Vⱼ = Cᵢⱼ. ' + (equations[0] || ''),
        'Los potenciales se muestran junto a cada fila y columna.',
        'Siguiente: calcular rᵢⱼ de las V.N.B.'),
      el('details', {}, el('summary', {}, 'Ver sustituciones de los potenciales'),
        el('ul', {}, equations.map((equation) => el('li', {}, equation)))));
  }
  if (step.kind === 'reduced') {
    const formula = choice ? 'r = ' + money(model, model.costs[choice.i][choice.j]) + ' − (' +
      money(model, potentials.rows[choice.i]) + ') − (' + money(model, potentials.columns[choice.j]) + ') = ' +
      money(model, reduced[choice.i][choice.j]) : 'rᵢⱼ = Cᵢⱼ − Uᵢ − Vⱼ ≥ 0';
    return el('div', { class: 'step-grid' }, transportTable(model, before, options),
      operation('Evaluar costos reducidos', choice ?
        'Existe una ruta que puede entrar a la base. ' + (step.bland ? 'Con Bland se toma la primera V.N.B. de costo reducido negativo.' :
          'La ruta de menor costo reducido negativo se destaca en la tabla.') :
        'Cada V.N.B. permitida tiene un costo reducido no negativo.', formula,
      choice ? route(model, choice.i, choice.j) + ' es la variable entrante.' : 'Se cumple la condición de optimalidad.',
      choice ? 'Siguiente: buscar el ciclo de ajuste.' : 'Siguiente: certificar el costo y comprobar alternativas.'));
  }
  if (step.kind === 'cycle' || step.kind === 'pivot') {
    const applied = step.kind === 'pivot';
    const donors = cycle.filter(({ sign }) => sign < 0).map(({ i, j }) => qty(model, before.allocation[i][j]));
    return el('div', { class: 'step-grid' }, transportTable(model, applied ? after : before, { ...options, reduced: null }),
      operation(applied ? 'Actualizar la base' : 'Cerrar el ciclo y calcular θ',
        'Cada fila y columna del ciclo tiene un signo + y un signo −. Así se mantienen los márgenes.',
        'θ = mín(' + donors.join(', ') + ') = ' + qty(model, step.theta) +
          (applied ? ' · ΔZ = ' + qty(model, step.theta) + ' × (' + money(model, choice.cost) + ') = ' + total(model, step.delta) : ''),
        applied ? 'Sale ' + route(model, step.leaving.i, step.leaving.j) + '. Z: ' + total(model, before.z) + ' → ' +
          total(model, after.z) + (step.theta === 0 ? '. Pivote degenerado: cambia la base.' : '.') :
          'El menor valor de las celdas donadoras fija el ajuste.',
        applied ? 'Siguiente: recalcular potenciales.' : 'Siguiente: sumar θ en + y restar θ en −.'));
  }
  return el('div', { class: 'step-grid' }, transportTable(model, after, options),
    operation('Óptimo verificado', 'Se conservaron las ofertas y demandas y los costos reducidos permitidos son no negativos.',
      'Z = ' + total(model, after.z) + ' = Σ Sᵢ Uᵢ + Σ Dⱼ Vⱼ',
      step.alternative ? 'Existe otro reparto con el mismo costo.' : 'El reparto óptimo es único.'),
    step.alternative && el('details', { class: 'alternative' }, el('summary', {}, 'Ver otro reparto óptimo'),
      transportTable(model, { ...after, allocation: step.alternative, basis: null })));
}
