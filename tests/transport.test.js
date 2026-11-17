import test from 'node:test';
import assert from 'node:assert/strict';
import { exercises, exerciseDraft, getExercise } from '../src/data/exercises.js';
import { checkTransport, transportModel } from '../src/core/transport-model.js';
import { initialMethods, solveInitial } from '../src/core/transport-initial.js';
import { validateBasis } from '../src/core/transport-basis.js';

test('cada inicializador completa los casos académicos y conserva la base', () => {
  for (const exercise of exercises.filter(({ topic }) => topic === 'transport')) {
    const model = transportModel(exerciseDraft(exercise));
    for (const method of initialMethods) {
      const result = solveInitial(model, method);
      assert.equal(result.status, 'feasible', exercise.id + ' / ' + method);
      assert.equal(checkTransport(model, result.state.allocation).ok, true);
      assert.equal(validateBasis(model.costs, result.state.allocation, result.state.basis), true);
      if (method === 'northwest' && exercise.expected.northwest !== undefined) {
        assert.equal(result.z / model.objectiveScale, exercise.expected.northwest);
      }
      for (const step of result.steps.filter(({ kind }) => kind === 'allocation')) {
        assert.ok(step.choice.quantity > 0);
        assert.equal(step.after.z - step.before.z, step.delta);
      }
    }
  }
});

test('balanceo agrega el ficticio correcto y conserva la matriz de entrada', () => {
  const abc = exerciseDraft(getExercise('abc'));
  const model = transportModel(abc);
  assert.deepEqual(model.fictitious, { axis: 'row', index: 3, amount: 30 });
  assert.deepEqual(abc.supply, [45, 60, 40]);
  assert.equal(transportModel(exerciseDraft(getExercise('electricidad'))).fictitious.axis, 'column');
  assert.equal(transportModel(exerciseDraft(getExercise('mataderos'))).fictitious, null);
});

test('las rutas prohibidas limitan una asignación aparentemente válida', () => {
  const model = transportModel({
    rows: ['A','B','C'], columns: ['1','2','3'], supply: [5,5,5], demand: [5,5,5],
    costs: [[0,1,null],[1,null,1],[null,1,1]]
  });
  const impossible = transportModel({
    rows: ['A','B'], columns: ['1','2'], supply: [5,5], demand: [5,5],
    costs: [[0,null],[1,null]]
  });
  assert.equal(solveInitial(impossible, 'minimum').status, 'infeasible');
  assert.equal(solveInitial(model, 'minimum').status, 'feasible');
  const limited = transportModel({
    rows: ['A','B'], columns: ['1','2'], supply: [7,3], demand: [5,5],
    costs: [[0,1],[1,null]]
  });
  const result = solveInitial(limited, 'minimum');
  assert.equal(result.steps[0].choice.bound, 5);
  assert.equal(result.steps[0].choice.quantity, 2);
  assert.deepEqual(result.state.allocation, [[2,5],[3,0]]);
});

test('una tabla degenerada conserva ceros básicos y una tabla desconectada usa un bosque', () => {
  const draft = { rows: ['A','B'], columns: ['1','2'], supply: [5,5], demand: [5,5], costs: [[1,1],[1,1]] };
  const model = transportModel(draft);
  const result = solveInitial(model, 'northwest');
  assert.deepEqual(result.state.allocation, [[5,0],[0,5]]);
  assert.equal(result.steps.at(-1).added.length, 1);
  const sparse = transportModel({ ...draft, costs: [[1,null],[null,1]] });
  assert.equal(solveInitial(sparse, 'minimum').steps.at(-1).added.length, 0);
  const empty = transportModel({ ...draft, supply: ['0,0',0], demand: [0,0] });
  assert.equal(solveInitial(empty, 'vogel').z, 0);
});
