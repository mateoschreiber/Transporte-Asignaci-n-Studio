import { numberAtScale, grid } from './input.js';
import { exerciseDraft, getExercise } from '../data/exercises.js';
import { checkTransport, transportModel } from './transport-model.js';
import { solveInitial } from './transport-initial.js';
import { solveModi } from './modi.js';
import { assignmentModel, checkAssignment } from './assignment-model.js';
import { solveHungarian } from './hungarian.js';
import { lpExercises } from '../data/lp-exercises.js';
import { parseLP, dot, validPoint } from './lp.js';
import { compare, divide, parseRational, subtract } from './rational.js';
import { solveGraphical } from './graphical.js';
import { solveSimplex } from './simplex.js';

export const EXAM_LENGTH = 20 * 60_000;
export const examTopics = { mixed: 'Mixto', transport: 'Transporte', assignment: 'Asignación',
  graphic: 'Método Gráfico', simplex: 'Método Simplex', 'mixed-general': 'Mixto general' };
const cases = { mixed: ['mataderos', 'maquinas'], transport: ['abc'], assignment: ['job-b'] };

export function examCases(topic) {
  const linear = {
    graphic: [['g3', 'graphic']],
    simplex: [['practica-max', 'simplex']],
    'mixed-general': [['sony', 'graphic'], ['practica-max', 'simplex']]
  };
  const lpCases = (Object.hasOwn(linear, topic) ? linear[topic] : []).map(([id, method]) => {
    const exercise = lpExercises.find((item) => item.id === id);
    const draft = exercise.variants[0].draft;
    return { id, exercise, draft, model: parseLP(draft), topic: method };
  });
  if (topic === 'mixed-general') return [...lpCases, ...examCases('mixed').map((item) => ({ ...item, brief: true }))];
  if (lpCases.length) return lpCases;
  return (cases[topic] || []).map((id) => {
    const exercise = getExercise(id);
    const draft = exerciseDraft(exercise);
    const model = exercise.topic === 'transport' ? transportModel(draft) : assignmentModel(draft);
    return { id, exercise, draft, model, topic: exercise.topic };
  });
}

export function startExam(topic, now) {
  if (!Object.hasOwn(examTopics, topic)) throw new Error('Tema de examen inválido.');
  return { topic, started: now, deadline: now + EXAM_LENGTH, finished: null, answers: {} };
}

export function finishExam(state, time) {
  const attempt = state.exam;
  if (!attempt || attempt.finished !== null) return false;
  attempt.finished = Math.max(attempt.started, Math.min(attempt.deadline, time));
  state.exams[attempt.topic] = attempt;
  return true;
}

export function examReference(item) {
  if (item.topic === 'graphic') return solveGraphical(item.model);
  if (item.topic === 'simplex') return solveSimplex(item.model);
  if (item.topic === 'transport') {
    const initial = solveInitial(item.model, 'northwest');
    const optimal = solveModi(item.model, initial.state);
    return { initial: initial.z, optimal: optimal.z, steps: [...initial.steps, ...optimal.steps] };
  }
  const result = solveHungarian(item.model);
  return { optimal: result.z, steps: result.steps };
}

function closeResponse(text, expected) {
  try {
    const difference = subtract(parseRational(text), expected);
    return Math.abs(Number(difference.numerator) / Number(difference.denominator)) <= 0.00005;
  } catch { return false; }
}

function linearResults(item, read, reference) {
  const { model } = item;
  const expected = item.topic === 'graphic' ? divide(model.constraints[0].bound, model.constraints[0].coefficients[0]) :
    reference.steps.find(({ kind }) => kind === 'pivot').pivotValue;
  let feasible = false;
  let optimal = false;
  try {
    const point = model.variables.map((_, i) => parseRational(read('x-' + i)));
    feasible = validPoint(model, point);
    optimal = feasible && compare(dot(model.objective, point), reference.value) === 0;
  } catch { /* Missing coordinates are reported in the grade. */ }
  return [
    { label: item.topic === 'graphic' ? 'Corte con X₁ de R1' : 'Primer pivote', ok: closeResponse(read('operation'), expected),
      text: item.topic === 'graphic' ? 'Fija X₂ = 0 en R1.' : 'La fila saliente tiene el menor cociente válido.' },
    { label: 'Factibilidad del punto', ok: feasible, text: 'Revisa los dominios y las restricciones originales.' },
    { label: 'Optimalidad y valor de Z', ok: optimal && closeResponse(read('z'), reference.value), text: 'Comprueba el punto óptimo y sustitúyelo en el objetivo.' }
  ].map((mark) => mark.ok ? { ...mark, text: 'Correcto.' } : mark);
}

function equalsNumber(response, scale, expected) {
  try {
    return numberAtScale(response, scale) === expected;
  } catch {
    return false;
  }
}

function transportResults(item, read, reference) {
  const { model } = item;
  const rows = [];
  function add(label, ok, text) {
    rows.push({ label, ok, text: ok ? 'Correcto.' : text });
  }
  const side = model.fictitious?.axis || 'none';
  add('Tipo de balanceo', read('balance') === side,
    side === 'row' ? 'El déficit requiere un origen ficticio.' : side === 'column' ?
      'El excedente requiere un destino ficticio.' : 'Las sumas coinciden. La tabla está balanceada.');
  if (side !== 'none') {
    add('Cantidad del ficticio', equalsNumber(read('fictitious'), model.quantityScale, model.fictitious.amount),
      'La magnitud del ficticio es la diferencia absoluta de los márgenes.');
  }
  if (item.id === 'abc') {
    add('Costo inicial por Esquina Noroeste',
      equalsNumber(read('initial'), model.objectiveScale, reference.initial),
      'Revisa qué margen se satisface antes de pasar a la siguiente celda de la tabla balanceada.');
  }
  const allocation = grid(model.m, model.n);
  let invalid = false;
  let entered = false;
  for (let i = 0; i < model.m; i++) for (let j = 0; j < model.n; j++) {
    const value = read('x-' + i + '-' + j);
    if (!value.trim()) continue;
    entered = true;
    try {
      allocation[i][j] = numberAtScale(value, model.quantityScale);
    } catch {
      invalid = true;
    }
  }
  const check = checkTransport(model, allocation);
  const feasible = entered && !invalid && check.ok;
  add('Factibilidad del reparto', feasible,
    invalid ? 'Hay cantidades que no se pueden interpretar con la precisión del ejercicio.' :
      !entered ? 'No se ingresó un reparto.' : check.issues.join(' '));
  add('Costo del reparto ingresado', feasible && equalsNumber(read('z'), model.objectiveScale, check.z),
    feasible ? 'Z debe sumar los productos costo × cantidad del reparto que ingresaste.' : 'Ingresa un reparto factible para contrastar su costo.');
  add('Optimalidad del reparto', feasible && check.z === reference.optimal,
    feasible ? 'El reparto conserva los márgenes y todavía se puede reducir su costo.' : 'Se requiere un reparto factible para verificar optimalidad.');
  add('Criterio MODI', read('criterion') === 'nonnegative', 'El criterio exige costos reducidos no negativos en las V.N.B. permitidas.');
  return rows;
}

function assignmentResults(item, read, reference) {
  const { model } = item;
  const pairs = model.rows.slice(0, model.m).flatMap((_, i) => {
    const answer = read('pair-' + i);
    if (!/^\d+$/.test(answer)) return [];
    return [{ i, j: Number(answer) }];
  });
  const check = checkAssignment(model, pairs);
  const cost = check.ok && equalsNumber(read('z'), model.costScale, check.z);
  return [
    { label: 'Orden de la matriz balanceada', ok: equalsNumber(read('order'), 1, model.size),
      text: 'El orden es el mayor de los dos tamaños originales.' },
    { label: 'Factibilidad de las parejas', ok: check.ok, text: check.issues.join(' ') },
    { label: 'Valor en la matriz original', ok: cost,
      text: check.ok ? 'Suma el valor original de cada pareja real que marcaste.' : 'Se requieren parejas factibles para contrastar el objetivo.' },
    { label: 'Optimalidad de las parejas', ok: check.ok && check.z === reference.optimal,
      text: check.ok ? 'Existe una selección de parejas permitidas con mejor objetivo.' : 'Se requiere una asignación factible para verificar optimalidad.' },
    { label: 'Certificado del método Húngaro', ok: read('criterion') === 'independent',
      text: 'Un conjunto de n ceros independientes certifica una asignación óptima en una matriz de orden n.' }
  ].map((item) => item.ok ? { ...item, text: 'Correcto.' } : item);
}

export function gradeExam(attempt) {
  const problems = examCases(attempt.topic).map((item) => {
    const read = (key) => attempt.answers[item.id + '-' + key] ?? '';
    const reference = examReference(item);
    const marks = item.brief
      ? [{ label: 'Valor óptimo de Z', ok: equalsNumber(read('z'), item.model.objectiveScale ?? item.model.costScale, reference.optimal),
        text: 'Contrasta el resultado con la resolución del laboratorio.' }]
      : item.topic === 'transport' ? transportResults(item, read, reference)
        : item.topic === 'assignment' ? assignmentResults(item, read, reference) : linearResults(item, read, reference);
    return { item, marks, reference };
  });
  const marks = problems.flatMap(({ marks }) => marks);
  return { problems, passed: marks.filter(({ ok }) => ok).length, total: marks.length };
}
