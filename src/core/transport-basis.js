import { grid } from './input.js';

function components(size) {
  const parent = Array.from({ length: size }, (_, i) => i);
  function root(node) {
    while (parent[node] !== node) node = parent[node];
    return node;
  }
  function join(a, b) {
    const from = root(a);
    const to = root(b);
    if (from === to) return false;
    parent[from] = to;
    return true;
  }
  return { root, join };
}

export function completeBasis(costs, allocation) {
  const m = costs.length;
  const n = costs[0].length;
  const forest = components(m + n);
  const basis = grid(m, n, false);
  const added = [];
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    if (!allocation[i][j]) continue;
    if (costs[i][j] === null || !forest.join(i, m + j)) throw new Error('Soporte de transporte inválido.');
    basis[i][j] = true;
  }
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    if (costs[i][j] !== null && !basis[i][j] && forest.join(i, m + j)) {
      basis[i][j] = true;
      added.push({ i, j });
    }
  }
  return { basis, added };
}

export function validateBasis(costs, allocation, basis) {
  const m = costs.length;
  const n = costs[0].length;
  const forest = components(m + n);
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    if (!basis[i][j]) {
      if (allocation[i][j] !== 0) return false;
      continue;
    }
    if (costs[i][j] === null || !forest.join(i, m + j)) return false;
  }
  return costs.every((row, i) => row.every((value, j) => value === null || forest.root(i) === forest.root(m + j)));
}

export function basisGraph(basis) {
  const m = basis.length;
  const n = basis[0].length;
  const edges = Array.from({ length: m + n }, () => []);
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    if (!basis[i][j]) continue;
    edges[i].push({ to: m + j, i, j });
    edges[m + j].push({ to: i, i, j });
  }
  return edges;
}
