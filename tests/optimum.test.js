import test from 'node:test';
import assert from 'node:assert/strict';
import { exercises, exerciseDraft } from '../src/data/exercises.js';
import { checkTransport, transportModel } from '../src/core/transport-model.js';
import { initialMethods, solveInitial } from '../src/core/transport-initial.js';
import { solveModi } from '../src/core/modi.js';

test('MODI alcanza el óptimo de cada ejercicio desde los cuatro inicializadores', () => {
  for (const exercise of exercises.filter(({ topic }) => topic === 'transport')) {
    const model = transportModel(exerciseDraft(exercise));
    for (const method of initialMethods) {
      const start = solveInitial(model, method);
      const result = solveModi(model, start.state);
      assert.equal(result.z / model.objectiveScale, exercise.expected.optimum, exercise.id + ' / ' + method);
      for (const step of result.steps.filter(({ kind }) => kind === 'pivot')) {
        assert.equal(checkTransport(model, step.after.allocation).ok, true);
        assert.equal(step.after.z - step.before.z, step.theta * step.choice.cost + 0);
        assert.ok(step.after.z <= step.before.z);
      }
      if (exercise.expected.multiple) {
        assert.notDeepEqual(result.alternative, result.state.allocation);
        assert.deepEqual(checkTransport(model, result.alternative), { ok: true, z: result.z, issues: [] });
      }
    }
  }
});

test('degeneración puede cambiar la base sin cambiar el reparto y activa Bland', () => {
  const model = transportModel({
    rows: ['A','B'], columns: ['1','2'], supply: [1,0], demand: [1,0], costs: [[0,4],[0,1]]
  });
  const result = solveModi(model, solveInitial(model, 'northwest').state);
  const pivots = result.steps.filter(({ kind }) => kind === 'pivot');
  assert.equal(pivots[0].theta, 0);
  assert.deepEqual(pivots[0].before.allocation, pivots[0].after.allocation);
  assert.equal(result.steps.filter(({ kind }) => kind === 'reduced').at(-1).bland, true);
  assert.equal(result.alternative, null);
});

function exhaustive(costs, margins, demands) {
  const rows = [...margins];
  const columns = [...demands];
  const width = columns.length;
  let minimum = Infinity;
  let count = 0;
  function assign(cell, z) {
    if (cell === rows.length * width) {
      if (rows.some(Boolean) || columns.some(Boolean)) return;
      if (z < minimum) {
        minimum = z;
        count = 0;
      }
      if (z === minimum) count++;
      return;
    }
    const i = Math.floor(cell / width);
    const j = cell % width;
    const cost = costs[i][j];
    const limit = cost === null ? 0 : Math.min(rows[i], columns[j]);
    for (let units = 0; units <= limit; units++) {
      rows[i] -= units;
      columns[j] -= units;
      assign(cell + 1, z + units * (cost ?? 0));
      rows[i] += units;
      columns[j] += units;
    }
  }
  assign(0, 0);
  return { minimum, count };
}

test('oráculo independiente: 160 tablas pequeñas con signo, prohibiciones, cero y empates', () => {
  let seed = 99076;
  const rand = (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 11) % max;
  };
  const labels = ['1', '2', '3'];
  for (let index = 0; index < 160; index++) {
    const costs = labels.map(() => labels.map(() => rand(4) === 0 ? null : rand(9) - 4));
    const supply = labels.map(() => rand(4));
    const demand = labels.map(() => rand(4));
    const model = transportModel({ rows: labels, columns: labels, costs, supply, demand });
    const expected = exhaustive(model.costs, model.supply, model.demand);
    for (const method of initialMethods) {
      const result = solveInitial(model, method);
      assert.equal(result.status === 'feasible', expected.count > 0, 'caso ' + index);
      if (!expected.count) continue;
      const optimum = solveModi(model, result.state);
      assert.equal(optimum.z, expected.minimum, 'caso ' + index);
      assert.equal(Boolean(optimum.alternative), expected.count > 1, 'alternativa caso ' + index);
    }
  }
});
