import test from 'node:test';
import assert from 'node:assert/strict';
import { lpExercises, model } from '../src/data/lp-exercises.js';
import { solveGraphical } from '../src/core/graphical.js';
import { solveSimplex } from '../src/core/simplex.js';
import { parseLP, dualLP, validPoint } from '../src/core/lp.js';
import { certifyDualPair, diagnoseSimplex } from '../src/core/lp-certificates.js';
import { formatRational } from '../src/core/rational.js';
import { emptyState, parseBackup } from '../src/state/progress.js';
import { startExam, gradeExam } from '../src/core/assessment.js';

const get = (id, i = 0) => parseLP(lpExercises.find((item) => item.id === id).variants[i].draft);

test('coinciden los dos métodos con los resultados comprobados de las guías', () => {
  for (const [id, expected] of Object.entries({
    sony: '410', agricultor: '5400', 'practica-max': '22000', alimentos: '670/9',
    'alimentos-kg': '260/3', mcdonalds: '160', camiones: '1250', industria: '45200'
  })) {
    for (const solve of [solveGraphical, solveSimplex]) {
      const result = solve(get(id));
      assert.equal(result.status, 'optimal', id);
      assert.equal(formatRational(result.value), expected, id);
    }
  }
});

test('Simplex reproduce los dos pivotes y la trayectoria de Práctica Máx', () => {
  const result = solveSimplex(get('practica-max'));
  assert.deepEqual(result.steps.filter((step) => step.kind === 'pivot').map((step) => formatRational(step.pivotValue)), ['2', '1']);
  assert.deepEqual(result.steps.filter((step) => step.kind === 'table').map((step) => formatRational(step.value)), ['0', '20000', '22000']);
});

test('dual de alimentos y detección de estados especiales', () => {
  assert.equal(formatRational(solveSimplex(dualLP(get('alimentos'))).value), '670/9');
  assert.equal(solveGraphical(get('g1')).status, 'unbounded');
  assert.equal(solveSimplex(get('g1')).status, 'unbounded');
  assert.ok(solveGraphical(get('g2', 1)).alternative);
  assert.deepEqual(solveGraphical(get('practica-max')).redundant, ['R3']);
  const impossible = parseLP(model('Vacío', 'max', [1, 0], [[1, 0, '<=', 0],[1, 0, '>=', 1]]));
  for (const solve of [solveGraphical, solveSimplex]) assert.equal(solve(impossible).status, 'infeasible');
  const certificate = solveGraphical(impossible);
  assert.equal(certificate.projectedVariable, 'Z');
  assert.deepEqual(certificate.contradiction.map(([a, b, sources]) =>
    [formatRational(a), formatRational(b), sources[0].plane.id]), [['-1', '-1', 'R2'], ['1', '0', 'R1']]);
  const auxiliary = solveSimplex(impossible).certificate;
  assert.deepEqual(auxiliary.multipliers.map(formatRational), ['-1', '1']);
  assert.deepEqual(auxiliary.coefficients.map(formatRational), ['0', '0']);
  assert.equal(formatRational(auxiliary.bound), '1');
});

test('una columna empatada produce un recorrido de pivotes válido', () => {
  const parsed = parseLP(model('Empate', 'max', [1, 1], [[1, 1, '<=', 3]]));
  const result = solveSimplex(parsed, [{ entering: 1 }]);
  assert.deepEqual(result.point.map(formatRational), ['0', '3']);
  assert.equal(formatRational(result.value), '3');
  assert.deepEqual(result.steps.find(({ kind }) => kind === 'pivot').enteringOptions, [0, 1]);
});

test('Gráfico distingue semiplano, recta y segmento con objetivo finito', () => {
  const free = ['free', 'free'];
  const cases = [
    { rows: [[1, 0, '<=', 2]], vertices: 0, unbounded: true, alternative: true },
    { rows: [[1, 0, '=', 2]], vertices: 0, unbounded: true, alternative: true },
    { rows: [[1, 0, '=', 2], [0, 1, '>=', -1], [0, 1, '<=', 1]], vertices: 2, unbounded: false, alternative: true }
  ];
  for (const fixture of cases) {
    const draft = parseLP(model('Sección', 'max', [1, 0], fixture.rows, free));
    const result = solveGraphical(draft);
    assert.equal(result.status, 'optimal');
    assert.equal(formatRational(result.value), '2');
    assert.equal(result.vertices.length, fixture.vertices);
    assert.equal(Boolean(result.recession.length), fixture.unbounded);
    assert.equal(Boolean(result.alternative), fixture.alternative);
    assert.ok(validPoint(draft, result.alternative));
  }
});

test('Simplex retira artificiales en cero y certifica dualidad y redundancia', () => {
  const dependent = parseLP(model('Dependencia', 'max', [1, 0], [[1, 1, '=', 3], [2, 2, '=', 6]]));
  assert.ok(solveSimplex(dependent).steps.some(({ kind }) => kind === 'remove'));
  const primal = get('alimentos');
  const dual = dualLP(primal);
  assert.ok(certifyDualPair(primal, dual, solveSimplex(primal), solveSimplex(dual)));
  const practice = get('practica-max');
  assert.deepEqual(diagnoseSimplex(practice, solveSimplex(practice)).redundant, ['R3']);
  const alternate = parseLP(model('Óptimos', 'max', [1, 1], [[1, 1, '<=', 3]]));
  assert.ok(validPoint(alternate, diagnoseSimplex(alternate, solveSimplex(alternate)).alternative));
});

test('migra el mixto v1 y mantiene el nuevo examen separado', () => {
  const state = emptyState();
  const active = startExam('mixed', 1000);
  const legacy = {
    version: 1, theme: 'dark', drafts: {}, completed: ['fundamentos'],
    study: { elapsed: 450, started: null }, exam: active, exams: {}
  };
  const migrated = parseBackup(JSON.stringify(legacy));
  assert.equal(migrated.version, state.version);
  assert.equal(migrated.study.elapsed, 450);
  assert.equal(migrated.lpStudy.elapsed, 0);
  assert.deepEqual(gradeExam(migrated.exam).problems.map(({ item }) => item.id), ['mataderos', 'maquinas']);
  assert.deepEqual(gradeExam(startExam('mixed-general', 1000)).problems.map(({ item }) => item.topic),
    ['graphic', 'simplex', 'transport', 'assignment']);
});
