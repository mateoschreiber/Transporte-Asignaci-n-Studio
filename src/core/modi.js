import { grid } from './input.js';
import { checkTransport, transportSnapshot } from './transport-model.js';
import { basisGraph, validateBasis } from './transport-basis.js';
import { feasibleFlow, residualRoutes } from './flow.js';
import { sameCell } from './transport-initial.js';

export function modiDecision(model, state, bland = false) {
  const { m, n, costs } = model;
  const graph = basisGraph(state.basis);
  const values = Array(m + n).fill(null);
  const equations = [];
  const anchors = [];
  for (let start = 0; start < values.length; start++) {
    if (values[start] !== null) continue;
    values[start] = 0;
    anchors.push(start);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const from = queue[head];
      for (const { to, i, j } of graph[from]) {
        if (values[to] !== null) continue;
        values[to] = costs[i][j] - values[from];
        equations.push({ i, j, axis: to < m ? 'row' : 'column' });
        queue.push(to);
      }
    }
  }
  const potentials = { rows: values.slice(0, m), columns: values.slice(m) };
  const reduced = grid(m, n, null);
  const negatives = [];
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    if (costs[i][j] === null) continue;
    const cost = costs[i][j] - potentials.rows[i] - potentials.columns[j];
    if (state.basis[i][j] && cost !== 0) throw new Error('Una variable básica tiene costo reducido distinto de cero.');
    reduced[i][j] = cost;
    if (cost < 0) negatives.push({ i, j, cost });
  }
  const least = Math.min(...negatives.map(({ cost }) => cost));
  const choices = bland ? negatives.slice(0, 1) : negatives.filter(({ cost }) => cost === least);
  return { graph, potentials, reduced, equations, anchors, choices, bland };
}

export function modiCycle(model, state, decision, chosen) {
  const choice = decision.choices.find((cell) => sameCell(cell, chosen));
  if (!choice) throw new Error('La variable entrante no cumple el criterio de MODI.');
  const start = model.m + choice.j;
  const end = choice.i;
  const parents = Array(model.m + model.n).fill(null);
  parents[start] = { from: -1 };
  const queue = [start];
  for (let head = 0; head < queue.length && !parents[end]; head++) {
    const from = queue[head];
    for (const { to, i, j } of decision.graph[from]) {
      if (parents[to]) continue;
      parents[to] = { from, i, j };
      queue.push(to);
    }
  }
  if (!parents[end]) throw new Error('La base no contiene el camino de la variable entrante.');
  const path = [];
  for (let node = end; node !== start;) {
    const { from, i, j } = parents[node];
    path.push({ i, j });
    node = from;
  }
  const cycle = [{ i: choice.i, j: choice.j, sign: 1 },
    ...path.reverse().map((cell, i) => ({ ...cell, sign: i % 2 ? 1 : -1 }))];
  const donors = cycle.filter((cell) => cell.sign < 0);
  const theta = Math.min(...donors.map(({ i, j }) => state.allocation[i][j]));
  const leaving = donors.filter(({ i, j }) => state.allocation[i][j] === theta)
    .sort((a, b) => a.i - b.i || a.j - b.j);
  return { choice, cycle, theta, leaving: decision.bland ? leaving.slice(0, 1) : leaving };
}

export function applyModi(model, state, decision, move, candidate) {
  const leaving = move.leaving.find((cell) => sameCell(cell, candidate));
  if (!leaving) throw new Error('La variable saliente debe ser una donadora con el valor mínimo.');
  const { choice, cycle, theta } = move;
  const after = transportSnapshot(state);
  for (const { i, j, sign } of cycle) after.allocation[i][j] += theta * sign;
  after.basis[choice.i][choice.j] = true;
  after.basis[leaving.i][leaving.j] = false;
  const delta = theta === 0 ? 0 : theta * choice.cost;
  after.z += delta;
  assertState(model, after);
  return {
    state: after,
    step: {
      kind: 'pivot', before: transportSnapshot(state), after, ...move, leaving, delta,
      potentials: decision.potentials, reduced: decision.reduced
    }
  };
}

function assertState(model, state) {
  const check = checkTransport(model, state.allocation);
  if (!check.ok || check.z !== state.z || !validateBasis(model.costs, state.allocation, state.basis)) {
    throw new Error('El pivote produjo un costo o una base incoherente.');
  }
}

function alternativeAllocation(model, state, reduced) {
  const tight = reduced.map((row) => row.map((value) => value === 0 ? 0 : null));
  const { supply, demand } = model;
  const routes = residualRoutes(tight, state.allocation, supply, demand);
  for (let i = 0; i < model.m; i++) for (let j = 0; j < model.n; j++) {
    if (tight[i][j] === null || routes.capacity(i, j) <= state.allocation[i][j]) continue;
    // An integer vertex differs by at least one scaled unit on some tight route.
    const amount = state.allocation[i][j] + 1;
    const row = [...supply];
    const column = [...demand];
    row[i] -= amount;
    column[j] -= amount;
    const flow = feasibleFlow(tight, row, column);
    if (flow.value !== flow.total) throw new Error('No se pudo reconstruir el reparto alternativo.');
    flow.allocation[i][j] += amount;
    const check = checkTransport(model, flow.allocation);
    if (check.ok && check.z === state.z) return flow.allocation;
    throw new Error('El reparto alternativo no conserva el costo.');
  }
  return null;
}

export function certifyModi(model, state, decision) {
  assertState(model, state);
  if (decision.reduced.some((row) => row.some((value) => value !== null && value < 0))) {
    throw new Error('Aún existe un costo reducido negativo.');
  }
  const { potentials, reduced } = decision;
  const dot = (left, right) => left.reduce((sum, value, i) => sum + BigInt(value) * BigInt(right[i]), 0n);
  const dual = dot(model.supply, potentials.rows) + dot(model.demand, potentials.columns);
  if (dual !== BigInt(state.z)) throw new Error('El costo primal no coincide con el certificado dual.');
  return {
    kind: 'transport-optimal', after: transportSnapshot(state), potentials, reduced, dual: Number(dual),
    alternative: alternativeAllocation(model, state, reduced)
  };
}

export function solveModi(model, starting, useBland = false) {
  let state = transportSnapshot(starting);
  let bland = useBland;
  const steps = [];
  assertState(model, state);
  while (true) {
    const decision = modiDecision(model, state, bland);
    const { potentials, reduced, equations, anchors } = decision;
    const before = transportSnapshot(state);
    const choice = decision.choices[0];
    steps.push({ kind: 'potentials', before, potentials, equations, anchors });
    steps.push({ kind: 'reduced', before, potentials, reduced, choice, bland });
    if (!choice) {
      const certificate = certifyModi(model, state, decision);
      steps.push(certificate);
      return { status: 'optimal', steps, state, z: state.z, alternative: certificate.alternative };
    }
    const move = modiCycle(model, state, decision, choice);
    steps.push({ kind: 'cycle', before, potentials, ...move });
    const pivot = applyModi(model, state, decision, move, move.leaving[0]);
    steps.push(pivot.step);
    state = pivot.state;
    bland ||= move.theta === 0;
  }
}
