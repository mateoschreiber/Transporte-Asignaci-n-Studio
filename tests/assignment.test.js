import test from 'node:test';
import assert from 'node:assert/strict';
import { allExercises, exerciseDraft } from '../src/data/exercises.js';
import { assignmentModel, checkAssignment } from '../src/core/assignment-model.js';
import { solveHungarian, validCover } from '../src/core/hungarian.js';

test('casos de Asignación, sin falsos óptimos en prohibiciones', () => {
  for (const exercise of allExercises.filter(({ topic }) => topic === 'assignment')) {
    const model = assignmentModel(exerciseDraft(exercise));
    const result = solveHungarian(model);
    assert.equal(result.status, exercise.expected.infeasible ? 'infeasible' : 'optimal', exercise.id);
    if (result.status !== 'optimal') continue;
    assert.equal(result.z / model.costScale, exercise.expected.optimum, exercise.id);
    assert.equal(checkAssignment(model, result.pairs).ok, true);
    for (const step of result.steps.filter(({ kind }) => kind === 'cover')) {
      assert.equal(validCover(step.after, step.rows, step.columns, step.matching.size), true);
    }
  }
});

test('trabajador o tarea obligatoria no puede quedar emparejado con un ficticio', () => {
  const draft = { rows: ['A','B'], columns: ['1','2','3'], costs: [[1,9,10],[8,1,9]], objective: 'min' };
  assert.equal(solveHungarian(assignmentModel(draft)).z, 2);
  assert.equal(solveHungarian(assignmentModel({ ...draft, requiredColumns: [false,false,true] })).z, 10);
  assert.equal(solveHungarian(assignmentModel({ ...draft, requiredColumns: [true,true,true] })).status, 'infeasible');
});

function bruteForce(model) {
  const best = { z: model.objective === 'max' ? -Infinity : Infinity, options: new Set() };
  const used = new Set();
  function next(i, z, pairs) {
    if (i === model.size) {
      const higher = model.objective === 'max' ? z > best.z : z < best.z;
      if (higher) {
        best.z = z;
        best.options.clear();
      }
      if (z === best.z) best.options.add(pairs.join(','));
      return;
    }
    for (let j = 0; j < model.size; j++) {
      const value = model.original[i][j];
      if (value === null || used.has(j)) continue;
      used.add(j);
      next(i + 1, z + value, i < model.m && j < model.n ? [...pairs, i + '-' + j] : pairs);
      used.delete(j);
    }
  }
  next(0, 0, []);
  return best;
}

test('oráculo independiente: 160 casos rectangulares, con prohibiciones y ambos objetivos', () => {
  let seed = 7135;
  function rand(n) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 12) % n;
  }
  const labels = ['A', 'B', 'C', 'D', 'E'];
  for (let count = 0; count < 160; count++) {
    const rows = labels.slice(0, 1 + rand(labels.length));
    const columns = labels.slice(0, 1 + rand(labels.length));
    const model = assignmentModel({
      rows, columns, objective: count % 2 ? 'min' : 'max',
      costs: rows.map(() => columns.map(() => rand(5) === 0 ? null : (rand(13) - 6) + ',5')),
      requiredRows: rows.map(() => rand(5) === 0), requiredColumns: columns.map(() => rand(5) === 0)
    });
    const expected = bruteForce(model);
    const result = solveHungarian(model);
    assert.equal(result.status === 'optimal', expected.options.size > 0);
    if (result.status === 'infeasible') continue;
    assert.equal(result.z, expected.z);
    assert.equal(Boolean(result.alternative), expected.options.size > 1);
    if (result.alternative) {
      assert.notDeepEqual(result.alternative, result.pairs);
      assert.equal(checkAssignment(model, result.alternative).z, expected.z);
    }
  }
});
