import test from 'node:test';
import assert from 'node:assert/strict';
import { finishExam, gradeExam, startExam } from '../src/core/assessment.js';
import { emptyState, parseBackup } from '../src/state/progress.js';

function abcAnswers(allocation) {
  const answers = {
    'abc-balance': 'row', 'abc-fictitious': '30', 'abc-initial': '735',
    'abc-z': '575', 'abc-criterion': 'nonnegative'
  };
  allocation.forEach((row, i) => row.forEach((units, j) => {
    answers['abc-x-' + i + '-' + j] = String(units);
  }));
  return answers;
}

test('examen: reconoce dos repartos óptimos y comprueba factibilidad además de Z', () => {
  const first = [[0, 5, 40], [50, 0, 10], [0, 40, 0], [0, 30, 0]];
  const second = [[0, 10, 35], [50, 0, 10], [0, 40, 0], [0, 25, 5]];
  const attempt = startExam('transport', 1000);
  for (const plan of [first, second]) {
    attempt.answers = abcAnswers(plan);
    const grade = gradeExam(attempt);
    assert.equal(grade.passed, grade.total);
  }
  attempt.answers['abc-x-0-1'] = '11';
  const grade = gradeExam(attempt);
  assert.equal(grade.problems[0].marks.find(({ label }) => label === 'Factibilidad del reparto').ok, false);
  assert.equal(grade.problems[0].marks.find(({ label }) => label === 'Optimalidad del reparto').ok, false);
});

test('examen: parejas prohibidas y columnas duplicadas reciben diagnóstico', () => {
  const attempt = startExam('assignment', 0);
  attempt.answers = {
    'job-b-order': '5', 'job-b-criterion': 'independent',
    'job-b-pair-0': '2', 'job-b-pair-1': '2', 'job-b-pair-2': 'none',
    'job-b-pair-3': '1', 'job-b-pair-4': '0', 'job-b-z': '120'
  };
  const mark = gradeExam(attempt).problems[0].marks.find(({ label }) => label === 'Factibilidad de las parejas');
  assert.equal(mark.ok, false);
  assert.match(mark.text, /prohibida/);
  assert.match(mark.text, /más de una pareja/);
});

test('respaldo: round-trip de borradores, progreso y exámenes, con rechazo de datos inválidos', () => {
  const state = emptyState();
  state.theme = 'dark';
  state.completed.push('modi');
  state.drafts.assignment = {
    topic: 'assignment', rows: ['<img src=x>'], columns: ['B', 'C'],
    costs: [['', null]], objective: 'min', requiredColumns: [true, false]
  };
  state.exam = startExam('transport', 345678);
  state.exam.answers = { 'abc-z': '575' };
  assert.equal(finishExam(state, 999999999), true);
  assert.equal(state.exam.finished, state.exam.deadline);
  assert.deepEqual(parseBackup(JSON.stringify(state)), state);
  for (const malformed of ['<html>', '{}', '{"version":2}', JSON.stringify({ ...state, completed: ['unknown'] }),
    JSON.stringify({ ...state, exam: { ...state.exam, deadline: 0 } }),
    JSON.stringify({ ...state, drafts: { assignment: { ...state.drafts.assignment, costs: [3] } } })]) {
    assert.throws(() => parseBackup(malformed), /sesión válida/);
  }
});
