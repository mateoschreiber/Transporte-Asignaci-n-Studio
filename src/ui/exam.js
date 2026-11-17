import { EXAM_LENGTH, examCases, examTopics, finishExam, gradeExam, startExam } from '../core/assessment.js';
import { assignmentStep } from './assignment.js';
import { button, el, pageTitle } from './dom.js';
import { matrixTable, sourceMatrix } from './table.js';
import { exerciseStatement, hasAdaptedTable } from './statement.js';
import { tracePlayer } from './trace.js';
import { balanceStep, transportStep } from './transport.js';
import { graphPlayer, lpStatement, modelFormulas } from './lp-lab.js';
import { simplexStep } from './lp-table.js';

const isLinear = (item) => item.topic === 'graphic' || item.topic === 'simplex';
const statement = (item) => isLinear(item) ? lpStatement(item.exercise) : exerciseStatement(item.exercise);

export function clockText(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

export function examView(state, save, render) {
  const attempt = state.exam;
  const started = attempt && attempt.finished === null;
  if (started) return examInProgress(attempt, save, () => {
    finishExam(state, Date.now());
    save();
    render(true);
  });
  if (attempt) return report(attempt, () => { state.exam = null; save(); render(true); });
  const choice = el('select', {},
    Object.entries(examTopics).map(([key, label]) => el('option', { value: key }, label)));
  const launch = button('Iniciar examen de 20 min', () => {
    state.exam = startExam(choice.value, Date.now());
    save();
    render(true);
  }, { class: 'primary' });
  return el('div', {},
    pageTitle('Examen simulado', 'Elige un tema y resuelve el intento en 20 minutos. La corrección aparece al entregar.'),
    el('section', { class: 'panel stack' }, el('h2', {}, 'Nuevo intento'),
      el('div', { class: 'actions' }, el('label', { class: 'field' }, 'Tema', choice), launch)),
    Object.keys(state.exams).length > 0 && el('section', { class: 'panel stack previous-exams' },
      el('h2', {}, 'Últimos intentos por tema'),
      el('div', { class: 'actions' }, Object.entries(state.exams).map(([topic, exam]) =>
        button('Revisar ' + examTopics[topic], () => { state.exam = exam; save(); render(true); })))));
}

function examInProgress(attempt, save, submit) {
  function bind(key, node) {
    node.value = attempt.answers[key] ?? '';
    node.addEventListener(node.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (Date.now() >= attempt.deadline) {
        submit();
        return;
      }
      attempt.answers[key] = node.value;
      save();
    });
    return node;
  }
  const cards = examCases(attempt.topic).map((item) => {
    const readKey = (name) => item.id + '-' + name;
    const input = (name, label, inline = false) => bind(readKey(name), el('input', { type: 'text',
      inputmode: 'decimal', maxlength: 24, ...(inline ? { 'aria-label': label } : {}) }));
    const metric = (name, title) => el('label', { class: 'field-vertical' }, title, input(name, title));
    const menu = (name, title, options) => el('label', { class: 'field-vertical' }, title, bind(readKey(name),
      el('select', {}, el('option', { value: '' }, 'Selecciona…'), options.map(([value, label]) => el('option', { value }, label)))));
    const { model } = item;
    const details = item.brief ? [metric('z', 'Valor óptimo de Z')] : isLinear(item) ? [
      modelFormulas(model),
      el('div', { class: 'answer-grid' },
        metric('operation', item.topic === 'graphic' ? 'Corte con X₁ de R1' : 'Primer pivote'),
        model.variables.map(({ name }, i) => metric('x-' + i, 'Valor de ' + name)),
        metric('z', 'Valor óptimo de Z'))
    ] : item.topic === 'transport' ? [
      el('div', { class: 'answer-grid' },
        menu('balance', 'Balanceo necesario', [['none', 'Ninguno'], ['row', 'Origen ficticio'], ['column', 'Destino ficticio']]),
        model.fictitious && metric('fictitious', 'Cantidad del ficticio'),
        item.id === 'abc' && metric('initial', 'Z inicial por Esquina Noroeste')),
      el('h3', {}, 'Reparto de costo mínimo'),
      el('p', { class: 'dim' }, 'Las celdas vacías del reparto cuentan como cero. Si hay ficticio, completa también su fila o columna.'),
      matrixTable(model.rows.map((row, i) => model.fictitious?.axis === 'row' && model.fictitious.index === i ? 'Fila adicional' : row),
        model.columns.map((column, j) => model.fictitious?.axis === 'column' && model.fictitious.index === j ? 'Columna adicional' : column),
        (i, j) => input('x-' + i + '-' + j, 'Cantidad fila ' + (i + 1) + ', columna ' + (j + 1), true),
        { className: 'exam-matrix', label: 'Escribir reparto de Transporte' }),
      el('div', { class: 'answer-grid' }, metric('z', 'Costo Z del reparto'),
        menu('criterion', 'Condición de optimalidad en MODI', [['zero', 'Todas las V.B. son positivas'],
          ['nonnegative', 'Todos los costos reducidos permitidos de V.N.B. son ≥ 0'], ['count', 'La base tiene el número esperado de V.B.']]))
    ] : [
      el('div', { class: 'answer-grid' }, metric('order', 'Orden de la matriz cuadrada'),
        menu('criterion', '¿Qué permite certificar el óptimo?', [['any', 'Existe al menos un cero por fila'],
          ['independent', 'Hay n ceros independientes en orden n'], ['unique', 'Cada fila se redujo una vez']])),
      el('h3', {}, 'Parejas de costo mínimo'),
      el('div', { class: 'answer-grid' }, model.rows.slice(0, model.m).map((row, i) =>
        menu('pair-' + i, row, [['none', 'Sin pareja real'],
          ...model.columns.slice(0, model.n).map((column, j) => [String(j), column])]))),
      el('div', { class: 'answer-grid' }, metric('z', 'Costo Z de las parejas'))
    ];
    return el('section', { class: 'panel stack', 'aria-label': item.exercise.title },
      el('h2', {}, item.exercise.title), statement(item),
      !isLinear(item) && hasAdaptedTable(item.exercise) && sourceMatrix(item.draft), details);
  });
  const clock = el('output', { class: 'exam-clock', 'data-exam-clock': '', 'aria-label': 'Tiempo restante' },
    clockText(attempt.deadline - Date.now()));
  const submitButton = button('Entregar examen', submit, { class: 'primary' });
  return el('div', {},
    pageTitle('Examen · ' + examTopics[attempt.topic], 'Puedes salir a otra sección. El tiempo sigue corriendo y las respuestas quedan en el borrador.'),
    el('div', { class: 'exam-bar panel' }, el('div', { class: 'field' }, 'Tiempo restante', clock), submitButton),
    el('div', { class: 'stack' }, cards));
}

function report(attempt, next) {
  const { problems, passed, total } = gradeExam(attempt);
  return el('div', {},
    pageTitle('Resultado · ' + examTopics[attempt.topic],
      passed + ' de ' + total + ' criterios correctos · ' + Math.round(passed * 100 / total) + '% · ' +
      clockText(attempt.finished - attempt.started) + ' de ' + clockText(EXAM_LENGTH),
      [button('Elegir otro examen', next)]),
    el('div', { class: 'stack' }, problems.map(({ item, marks, reference }) => {
      const slot = el('div', { class: 'exam-solution' });
      const open = button('Revisar solución', () => {
        if (slot.firstChild) {
          slot.replaceChildren();
          open.textContent = 'Revisar solución';
          open.setAttribute('aria-expanded', 'false');
          return;
        }
        const transport = item.topic === 'transport';
        slot.replaceChildren(item.topic === 'graphic' ? graphPlayer(item.model, reference) :
          tracePlayer(transport ? [balanceStep(item.model), ...reference.steps] : reference.steps,
            (step) => transport ? transportStep(item.model, step) :
              item.topic === 'simplex' ? simplexStep(step) : assignmentStep(item.model, step)));
        open.textContent = 'Ocultar solución';
        open.setAttribute('aria-expanded', 'true');
      }, { 'aria-expanded': 'false' });
      return el('section', { class: 'panel stack' }, el('h2', {}, item.exercise.title),
        statement(item),
        el('ul', { class: 'marks' }, marks.map(({ label, ok, text }) =>
          el('li', { class: ok ? 'correct' : 'incorrect' },
            el('strong', {}, (ok ? '✓ ' : '× ') + label), el('p', {}, text)))),
        el('div', { class: 'actions' }, open), slot);
    })));
}
