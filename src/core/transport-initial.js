import { copyMatrix, grid, sum } from './input.js';
import { feasibleFlow, residualRoutes } from './flow.js';
import { completeBasis } from './transport-basis.js';
import { checkTransport, transportSnapshot } from './transport-model.js';

export const initialMethods = ['northwest', 'minimum', 'vogel', 'russell'];
const byPosition = (a, b) => a.i - b.i || a.j - b.j;
export const sameCell = (a, b) => a.i === b.i && a.j === b.j;

export function initialState(model) {
  const supply = [...model.supply];
  const demand = [...model.demand];
  return { allocation: grid(model.m, model.n), supply, demand, z: 0 };
}

export function initialDecision(model, state, method) {
  const { costs, m, n } = model;
  const { supply, demand } = state;
  const remaining = sum(supply);
  if (remaining === 0) return { status: 'done' };
  if (!initialMethods.includes(method)) throw new Error('Método de inicialización desconocido.');
  if (remaining !== sum(demand)) throw new Error('La tabla debe estar balanceada.');
  const restricted = costs.some((row) => row.includes(null));
  let routes;
  if (restricted) {
    const flow = feasibleFlow(costs, supply, demand);
    if (flow.value !== flow.total) return { status: 'infeasible', unmet: flow.total - flow.value, flow: flow.allocation };
    routes = residualRoutes(costs, flow.allocation, supply, demand);
  }
  const cells = [];
  const rows = Array.from({ length: m }, () => []);
  const columns = Array.from({ length: n }, () => []);
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    if (!supply[i] || !demand[j] || costs[i][j] === null || (routes && !routes.eligible(i, j))) continue;
    const cell = { i, j, cost: costs[i][j] };
    cells.push(cell);
    rows[i].push(cell);
    columns[j].push(cell);
  }
  let choices;
  let lines;
  let scores;
  let maxima;
  if (method === 'northwest') choices = cells.slice(0, 1);
  if (method === 'minimum') {
    const minimum = Math.min(...cells.map(({ cost }) => cost));
    choices = cells.filter(({ cost }) => cost === minimum);
  }
  if (method === 'vogel') {
    lines = [...rows.map((group, i) => ({ group, axis: 'row', index: i })),
      ...columns.map((group, j) => ({ group, axis: 'column', index: j }))]
      .filter(({ group }) => group.length > 0)
      .map(({ group, axis, index }) => {
        const ordered = [...group].sort((a, b) => a.cost - b.cost || byPosition(a, b));
        return {
          axis, index, forced: ordered.length === 1, minimum: ordered[0].cost,
          second: ordered[1]?.cost, penalty: ordered.length === 1 ? null : ordered[1].cost - ordered[0].cost,
          choices: ordered.filter((cell) => cell.cost === ordered[0].cost)
        };
      });
    const highest = Math.max(...lines.map(({ penalty }) => penalty ?? Infinity));
    for (const line of lines) line.eligible = (line.penalty ?? Infinity) === highest;
    choices = cells.filter((cell) => lines.some((line) => line.eligible && line.choices.some((option) => sameCell(cell, option))));
  }
  if (method === 'russell') {
    maxima = {
      rows: rows.map((row) => row.length ? Math.max(...row.map(({ cost }) => cost)) : null),
      columns: columns.map((column) => column.length ? Math.max(...column.map(({ cost }) => cost)) : null)
    };
    scores = grid(m, n, null);
    for (const { i, j, cost } of cells) scores[i][j] = cost - maxima.rows[i] - maxima.columns[j];
    const minimum = Math.min(...cells.map(({ i, j }) => scores[i][j]));
    choices = cells.filter(({ i, j }) => scores[i][j] === minimum);
  }
  if (!choices.length) throw new Error('No se encontró una ruta elegible para una tabla factible.');
  const options = choices.map((cell) => {
    const { i, j } = cell;
    const bound = Math.min(supply[i], demand[j]);
    return { ...cell, bound, quantity: routes ? routes.capacity(i, j) : bound };
  });
  return { status: 'ready', choices: options, cells, lines, scores, maxima, method };
}

export function applyInitialDecision(state, decision, choice) {
  const option = decision.choices.find((candidate) => sameCell(candidate, choice));
  if (!option) throw new Error('La selección no cumple el criterio del método.');
  const { i, j, cost, quantity } = option;
  const next = transportSnapshot(state);
  next.allocation[i][j] += quantity;
  next.supply[i] -= quantity;
  next.demand[j] -= quantity;
  next.z += quantity * cost;
  return {
    state: next,
    step: {
      kind: 'allocation', method: decision.method, before: transportSnapshot(state),
      after: next, choice: option, decision, delta: quantity * cost
    }
  };
}

export function finishInitial(model, state) {
  const verified = checkTransport(model, state.allocation);
  if (!verified.ok) throw new Error(verified.issues.join(' '));
  const { basis, added } = completeBasis(model.costs, state.allocation);
  const after = { ...transportSnapshot(state), basis };
  return { kind: 'basis', before: transportSnapshot(state), after, added };
}

export function solveInitial(model, method, starting = initialState(model)) {
  const steps = [];
  let state = transportSnapshot(starting);
  while (true) {
    const decision = initialDecision(model, state, method);
    if (decision.status === 'infeasible') {
      steps.push({ kind: 'transport-infeasible', decision, before: state, after: state });
      return { status: 'infeasible', steps };
    }
    if (decision.status === 'done') break;
    const applied = applyInitialDecision(state, decision, decision.choices[0]);
    steps.push(applied.step);
    state = applied.state;
  }
  const completed = finishInitial(model, state);
  steps.push(completed);
  return { status: 'feasible', steps, state: { ...completed.after, basis: copyMatrix(completed.after.basis) }, z: state.z };
}
