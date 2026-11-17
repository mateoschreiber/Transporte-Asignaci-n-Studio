import { InputError, assertArithmetic, copyMatrix, decimals, parseCosts, sum } from './input.js';

export function transportModel(draft, balance = true) {
  const { m, n, costs, costScale, maximum } = parseCosts(draft);
  if (draft.supply?.length !== m || draft.demand?.length !== n) {
    throw new InputError('Completa la oferta y la demanda de la matriz.');
  }
  const { values, scale } = decimals([
    ...draft.supply.map((amount, i) => [amount, 'la oferta de ' + draft.rows[i], 'supply-' + i]),
    ...draft.demand.map((amount, j) => [amount, 'la demanda de ' + draft.columns[j], 'demand-' + j])
  ], true);
  const supply = values.slice(0, m);
  const demand = values.slice(m);
  const rows = draft.rows.map((label, i) => label.trim() || 'Origen ' + (i + 1));
  const columns = draft.columns.map((label, j) => label.trim() || 'Destino ' + (j + 1));
  const totalSupply = sum(supply);
  const totalDemand = sum(demand);
  const total = Math.max(totalSupply, totalDemand);
  assertArithmetic(total);
  assertArithmetic(total * Math.max(1, maximum) * 4);
  assertArithmetic(costScale * scale);
  const difference = totalSupply - totalDemand;
  let fictitious = Number.isInteger(draft.fictitiousRow) && draft.fictitiousRow >= 0 && draft.fictitiousRow < m
    ? { axis: 'row', index: draft.fictitiousRow, amount: supply[draft.fictitiousRow], embedded: true } : null;
  if (balance && difference < 0) {
    fictitious = { axis: 'row', index: m, amount: -difference };
    rows.push('Origen ficticio');
    supply.push(-difference);
    costs.push(Array(n).fill(0));
  } else if (balance && difference > 0) {
    fictitious = { axis: 'column', index: n, amount: difference };
    columns.push('Destino ficticio');
    demand.push(difference);
    costs.forEach((row) => row.push(0));
  }
  return {
    rows, columns, costs, supply, demand, totalSupply, totalDemand, difference,
    fictitious, costScale, quantityScale: scale, objectiveScale: costScale * scale,
    m: rows.length, n: columns.length
  };
}

export function transportCost(costs, allocation) {
  return allocation.reduce((total, row, i) =>
    total + row.reduce((subtotal, amount, j) => subtotal + amount * (costs[i][j] ?? 0), 0), 0);
}

export function checkTransport(model, allocation) {
  const issues = [];
  if (allocation.length !== model.m || allocation.some((row) => row.length !== model.n)) {
    return { ok: false, issues: ['La matriz no coincide con el modelo balanceado.'] };
  }
  const cols = Array(model.n).fill(0);
  allocation.forEach((row, i) => {
    if (row.some((value) => !Number.isSafeInteger(value) || value < 0)) {
      issues.push('Hay cantidades inválidas en ' + model.rows[i] + '.');
    }
    row.forEach((value, j) => {
      if (model.costs[i][j] === null && value !== 0) {
        issues.push('Ruta prohibida: ' + model.rows[i] + ' → ' + model.columns[j] + '.');
      }
      cols[j] += value;
    });
    if (sum(row) !== model.supply[i]) issues.push('La oferta de ' + model.rows[i] + ' no se conserva.');
  });
  cols.forEach((value, j) => {
    if (value !== model.demand[j]) issues.push('La demanda de ' + model.columns[j] + ' no se conserva.');
  });
  return { ok: issues.length === 0, issues, z: issues.length ? null : transportCost(model.costs, allocation) };
}

export function transportSnapshot(state) {
  return {
    allocation: copyMatrix(state.allocation), supply: [...state.supply], demand: [...state.demand],
    z: state.z, ...(state.basis && { basis: copyMatrix(state.basis) })
  };
}
