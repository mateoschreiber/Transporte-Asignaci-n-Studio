import { grid, sum } from './input.js';

function network(size) {
  const graph = Array.from({ length: size }, () => []);
  function edge(from, to, capacity) {
    const forward = { to, left: capacity, reverse: graph[to].length };
    graph[to].push({ to: from, left: 0, reverse: graph[from].length });
    graph[from].push(forward);
    return forward;
  }
  function send(source, sink, limit) {
    let value = 0;
    while (value < limit) {
      const parents = Array(size).fill(null);
      const queue = [source];
      parents[source] = { previous: -1 };
      for (let head = 0; head < queue.length && !parents[sink]; head++) {
        const previous = queue[head];
        graph[previous].forEach((arc, index) => {
          if (arc.left > 0 && !parents[arc.to]) {
            parents[arc.to] = { previous, index };
            queue.push(arc.to);
          }
        });
      }
      if (!parents[sink]) break;
      let amount = limit - value;
      for (let node = sink; node !== source;) {
        const { previous, index } = parents[node];
        amount = Math.min(amount, graph[previous][index].left);
        node = previous;
      }
      for (let node = sink; node !== source;) {
        const { previous, index } = parents[node];
        const arc = graph[previous][index];
        arc.left -= amount;
        graph[node][arc.reverse].left += amount;
        node = previous;
      }
      value += amount;
    }
    return value;
  }
  return { edge, send };
}

export function feasibleFlow(costs, supply, demand) {
  const m = supply.length;
  const n = demand.length;
  const total = sum(supply);
  const source = m + n;
  const sink = source + 1;
  const flow = network(sink + 1);
  const arcs = grid(m, n, null);
  supply.forEach((amount, i) => flow.edge(source, i, amount));
  demand.forEach((amount, j) => flow.edge(m + j, sink, amount));
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    if (costs[i][j] !== null) arcs[i][j] = flow.edge(i, m + j, total);
  }
  const value = flow.send(source, sink, total);
  return { value, total, allocation: arcs.map((row) => row.map((arc) => arc ? total - arc.left : 0)) };
}

export function residualRoutes(costs, base, supply, demand) {
  const m = supply.length;
  const n = demand.length;
  const edges = [];
  const adjacency = Array.from({ length: m + n }, () => []);
  const add = (from, to, capacity) => {
    if (capacity <= 0) return;
    edges.push({ from, to, capacity });
    adjacency[from].push(to);
  };
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    if (costs[i][j] === null) continue;
    // Increasing a route must be compensated by a path of increases and decreases.
    add(i, m + j, Math.min(supply[i], demand[j]) - base[i][j]);
    add(m + j, i, base[i][j]);
  }
  const reachable = demand.map((amount, j) => {
    const reached = new Set();
    if (!amount) return reached;
    const queue = [m + j];
    reached.add(m + j);
    for (let head = 0; head < queue.length; head++) {
      for (const to of adjacency[queue[head]]) if (!reached.has(to)) {
        reached.add(to);
        queue.push(to);
      }
    }
    return reached;
  });
  function capacity(i, j) {
    const max = Math.min(supply[i], demand[j]);
    const current = base[i][j];
    if (current === max || !reachable[j].has(i)) return current;
    const adjustment = network(m + n);
    for (const arc of edges) {
      // The other arcs of the cycle must carry all of the compensation.
      if ((arc.from === i && arc.to === m + j) || (arc.from === m + j && arc.to === i)) continue;
      adjustment.edge(arc.from, arc.to, arc.capacity);
    }
    return current + adjustment.send(m + j, i, max - current);
  }
  return { capacity, eligible: (i, j) => base[i][j] > 0 || reachable[j].has(i) };
}
