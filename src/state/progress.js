import { MAX_DIMENSION } from '../core/input.js';
import { getExercise, modules } from '../data/exercises.js';
import { lpExercises } from '../data/lp-exercises.js';
import { examTopics } from '../core/assessment.js';

export const STORAGE_KEY = 'transporte-asignacion-studio-v1';
export const MAX_BACKUP_SIZE = 500_000;
const moduleIds = modules.map(({ id }) => id);

export function emptyState() {
  return { version: 2, theme: 'light', drafts: {}, completed: [], study: { elapsed: 0, started: null },
    lpStudy: { elapsed: 0, started: null }, lpCompleted: [], linear: {}, practice: {}, exam: null, exams: {} };
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const label = (value) => typeof value === 'string' && value.length <= 60;
const cell = (value) => value === null || (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.length <= 24);
const time = (value) => Number.isSafeInteger(value) && value >= 0;

function invalid() {
  throw new Error('El archivo no corresponde a una sesión válida de Studio.');
}

function checkedDraft(value, topic) {
  if (!isRecord(value) || value.topic !== topic) invalid();
  const { rows, columns, costs } = value;
  const labels = (list) => Array.isArray(list) && list.length >= 1 &&
    list.length <= MAX_DIMENSION && list.every(label);
  if (!labels(rows) || !labels(columns) ||
      !Array.isArray(costs) || costs.length !== rows.length ||
      !costs.every((row) => Array.isArray(row) && row.length === columns.length && row.every(cell))) invalid();
  const draft = { topic, rows, columns, costs };
  if (getExercise(value.exerciseId)?.topic === topic) draft.exerciseId = value.exerciseId;
  if (topic === 'transport') {
    const margins = (list, length) => Array.isArray(list) && list.length === length &&
      list.every((amount) => amount !== null && cell(amount));
    if (!margins(value.supply, rows.length) || !margins(value.demand, columns.length)) invalid();
    draft.supply = value.supply;
    draft.demand = value.demand;
    if (Number.isInteger(value.fictitiousRow) && value.fictitiousRow >= 0 && value.fictitiousRow < rows.length) {
      draft.fictitiousRow = value.fictitiousRow;
    }
  } else {
    if (!['min', 'max'].includes(value.objective)) invalid();
    draft.objective = value.objective;
    for (const [name, length] of [['requiredRows', rows.length], ['requiredColumns', columns.length]]) {
      if (value[name] === undefined) continue;
      if (!Array.isArray(value[name]) || value[name].length !== length ||
          !value[name].every((flag) => typeof flag === 'boolean')) invalid();
      draft[name] = value[name];
    }
  }
  return draft;
}

function checkedExam(value) {
  if (!isRecord(value) || !Object.hasOwn(examTopics, value.topic) ||
      !time(value.started) || !time(value.deadline) || value.deadline !== value.started + 20 * 60_000 ||
      (value.finished !== null && (!time(value.finished) || value.finished < value.started || value.finished > value.deadline)) ||
      !isRecord(value.answers)) invalid();
  const answers = {};
  for (const [key, response] of Object.entries(value.answers)) {
    if (!/^[a-z0-9-]{1,80}$/.test(key) || typeof response !== 'string' || response.length > 100) invalid();
    answers[key] = response;
  }
  return { topic: value.topic, started: value.started, deadline: value.deadline, finished: value.finished, answers };
}

function checkedLinear(value, topic) {
  if (!isRecord(value) || !isRecord(value.draft) || !['learn', 'practice'].includes(value.mode) ||
      !time(value.step) || !time(value.variant)) invalid();
  const item = lpExercises.find(({ id }) => id === value.exercise);
  if ((!item && value.exercise !== 'custom') || (item && value.variant >= item.variants.length)) invalid();
  const { name, sense, variables, objective, constraints } = value.draft;
  const choices = value.choices ?? [];
  if (!Array.isArray(choices) || !choices.every((choice) => choice === null || (isRecord(choice) &&
      (choice.entering === undefined || time(choice.entering)) && (choice.leaving === undefined || time(choice.leaving))))) invalid();
  const string = (entry) => typeof entry === 'string' && entry.length <= 80;
  if (!string(name) || !['max', 'min'].includes(sense) ||
      !Array.isArray(variables) || variables.length < 1 || variables.length > MAX_DIMENSION ||
      (topic === 'graphic' && variables.length !== 2) ||
      !variables.every((v) => isRecord(v) && string(v.name) && ['positive', 'negative', 'free'].includes(v.domain)) ||
      !Array.isArray(objective) || objective.length !== variables.length || !objective.every(string) ||
      !Array.isArray(constraints) || constraints.length > MAX_DIMENSION ||
      !constraints.every((r) => isRecord(r) && /^R[1-9]\d*$/.test(r.id) && ['<=', '>=', '='].includes(r.operator) &&
        string(r.bound) && Array.isArray(r.coefficients) && r.coefficients.length === variables.length &&
        r.coefficients.every(string)) || new Set(constraints.map(({ id }) => id)).size !== constraints.length) invalid();
  return {
    exercise: value.exercise, variant: value.variant, mode: value.mode, step: value.step,
    choices: choices.map((choice) => choice && ({ entering: choice.entering, leaving: choice.leaving })),
    draft: { name, sense, objective, variables: variables.map(({ name, domain }) => ({ name, domain })),
      constraints: constraints.map(({ id, operator, bound, coefficients }) => ({ id, operator, bound, coefficients })) }
  };
}

export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_SIZE) invalid();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    invalid();
  }
  if (!isRecord(value) || ![1, 2].includes(value.version) || !['light', 'dark'].includes(value.theme) ||
      !isRecord(value.drafts) || !Array.isArray(value.completed) ||
      !value.completed.every((id) => moduleIds.includes(id)) ||
      !isRecord(value.study) || !time(value.study.elapsed) ||
      (value.study.started !== null && !time(value.study.started))) invalid();
  const state = emptyState();
  state.theme = value.theme;
  state.completed = [...new Set(value.completed)];
  state.study = { elapsed: value.study.elapsed, started: value.study.started };
  if (value.version === 2) {
    if (!isRecord(value.linear) || !Array.isArray(value.lpCompleted) ||
        !value.lpCompleted.every((id) => ['fundamentos', 'graphic', 'simplex', 'practica'].includes(id)) ||
        !isRecord(value.lpStudy) || !time(value.lpStudy.elapsed) ||
        (value.lpStudy.started !== null && !time(value.lpStudy.started))) invalid();
    state.lpCompleted = [...new Set(value.lpCompleted)];
    state.lpStudy = { elapsed: value.lpStudy.elapsed, started: value.lpStudy.started };
    for (const topic of ['graphic', 'simplex']) {
      if (Object.hasOwn(value.linear, topic)) state.linear[topic] = checkedLinear(value.linear[topic], topic);
    }
    if (value.practice !== undefined) {
      if (!isRecord(value.practice)) invalid();
      for (const topic of ['transport', 'assignment']) {
        if (!Object.hasOwn(value.practice, topic)) continue;
        const entry = value.practice[topic];
        if (!isRecord(entry) || typeof entry.signature !== 'string' || entry.signature.length > MAX_BACKUP_SIZE ||
            !Array.isArray(entry.history) || !entry.history.every((events) => Array.isArray(events) &&
              events.every((event) => Array.isArray(event) && event.length === 3 && time(event[0]) &&
                ['click', 'input', 'change'].includes(event[1]) &&
                (typeof event[2] === 'boolean' || (typeof event[2] === 'string' && event[2].length <= 100))))) invalid();
        state.practice[topic] = { signature: entry.signature, history: entry.history };
      }
    }
  }
  for (const topic of ['transport', 'assignment']) {
    if (Object.hasOwn(value.drafts, topic)) state.drafts[topic] = checkedDraft(value.drafts[topic], topic);
  }
  if (value.exam !== null) state.exam = checkedExam(value.exam);
  if (value.exams !== undefined) {
    if (!isRecord(value.exams)) invalid();
    for (const topic of Object.keys(examTopics)) {
      if (!Object.hasOwn(value.exams, topic)) continue;
      const exam = checkedExam(value.exams[topic]);
      if (exam.topic !== topic || exam.finished === null) invalid();
      state.exams[topic] = exam;
    }
  }
  return state;
}

export function readSession() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState(), available: false };
  }
  try {
    return { state: raw ? parseBackup(raw) : emptyState(), available: true, invalid: false };
  } catch {
    return { state: emptyState(), available: true, invalid: true };
  }
}

export function writeSession(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
