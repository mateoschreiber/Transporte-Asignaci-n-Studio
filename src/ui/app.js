import { allExercises, exerciseDraft, getExercise, modules } from '../data/exercises.js';
import { MAX_BACKUP_SIZE, parseBackup, readSession, writeSession } from '../state/progress.js';
import { announce, button, el, link, pageTitle } from './dom.js';
import { editMatrix } from './matrix.js';
import { sourceMatrix } from './table.js';
import { exerciseStatement } from './statement.js';
import { transportLab } from './transport-lab.js';
import { assignmentControls, assignmentLab } from './assignment-lab.js';
import { clockText, examView } from './exam.js';
import { finishExam } from '../core/assessment.js';
import { lpExercises } from '../data/lp-exercises.js';
import { lpLab, lpRoutes, lpStatement, lpTitles } from './lp-lab.js';

const main = document.querySelector('main');
const nav = document.querySelector('#navigation');
const dialog = document.querySelector('#session-dialog');
const theme = document.querySelector('#theme');
const session = readSession();
let { state, available } = session;
let route = 'inicio';
let requestedExercise = null;
let requestedLP = null;
const linearTopics = Object.keys(lpRoutes);

const paths = { transport: 'transporte', assignment: 'asignacion' };
const topicLabels = { transport: 'Transporte', assignment: 'Asignación' };
const sections = [
  ['inicio', 'Inicio'], ['repaso', 'Repaso'], ['biblioteca', 'Biblioteca'],
  ['grafico', lpTitles.graphic], ['simplex', lpTitles.simplex],
  ['transporte', 'Transporte'], ['asignacion', 'Asignación'], ['examen', 'Examen']
];
const view = {
  inicio: renderHome, repaso: renderReview, biblioteca: renderLibrary,
  transporte: () => renderLab('transport'), asignacion: () => renderLab('assignment'),
  grafico: () => renderLP('graphic'), simplex: () => renderLP('simplex'),
  examen: () => examView(state, save, render)
};

function save() {
  available = writeSession(state);
}

function go(target) {
  if (location.hash === '#' + target) render(true);
  else location.hash = target;
}

function openLP(topic, id, mode) {
  const exercise = lpExercises.find((item) => item.id === id);
  state.linear[topic] = { exercise: id, variant: 0, mode, step: 0,
    draft: structuredClone(exercise.variants[0].draft) };
  requestedLP = { topic, mode };
  save();
  go(lpRoutes[topic]);
}

function renderLP(topic) {
  const mode = requestedLP?.topic === topic ? requestedLP.mode : undefined;
  requestedLP = null;
  return lpLab(topic, state, save, render, go, mode);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  theme.textContent = state.theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
}

theme.addEventListener('click', () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  save();
});
document.querySelector('.skip').addEventListener('click', (event) => {
  event.preventDefault();
  main.focus();
});
document.querySelector('#session').addEventListener('click', openSession);
window.addEventListener('hashchange', () => render(true));

function openSession() {
  const result = el('p', { role: 'status' });
  const file = el('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Archivo de sesión JSON' });
  const importBackup = button('Importar y reemplazar sesión', async () => {
    const selected = file.files[0];
    if (!selected || selected.size > MAX_BACKUP_SIZE) {
      result.textContent = 'Selecciona un archivo JSON de hasta 500 kB.';
      return;
    }
    importBackup.disabled = true;
    try {
      state = parseBackup(await selected.text());
      requestedExercise = null;
      save();
      applyTheme();
      dialog.close();
      render();
      announce('Sesión importada.');
    } catch (error) {
      result.textContent = error.message;
    } finally {
      importBackup.disabled = false;
    }
  });
  dialog.replaceChildren(
    el('h2', { id: 'session-title' }, 'Mi sesión'),
    el('p', { class: 'dim' }, available ? 'El navegador guarda tu progreso en este archivo.' :
      'El almacenamiento local no está disponible. Exporta una copia antes de cerrar.'),
    el('div', { class: 'stack session-controls' },
      button('Exportar sesión JSON', () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
        const download = el('a', { href: url, download: 'sesion-transporte-asignacion.json' });
        document.body.append(download);
        download.click();
        download.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, { class: 'primary' }),
      el('label', { class: 'field-vertical' }, 'Restaurar una sesión desde JSON', file),
      importBackup,
      result,
      button('Cerrar', () => dialog.close())
    )
  );
  dialog.showModal();
}

function render(moveFocus = false) {
  expireExam();
  const next = location.hash.slice(1);
  route = Object.hasOwn(view, next) ? next : 'inicio';
  nav.replaceChildren(...sections.map(([id, title]) => link(title, id, { 'aria-current': id === route ? 'page' : null })));
  main.replaceChildren(view[route]());
  if (moveFocus) {
    window.scrollTo({ top: 0 });
    main.focus({ preventScroll: true });
  }
}

function openExercise(id, preset = {}) {
  const exercise = getExercise(id);
  state.drafts[exercise.topic] = exerciseDraft(exercise);
  requestedExercise = { exercise, ...preset };
  save();
  const target = paths[exercise.topic];
  if (route === target) render(true);
  else location.hash = target;
}

function renderHome() {
  const starter = getExercise('mataderos');
  return el('div', {},
    el('section', { class: 'hero' },
      el('div', {},
        el('h1', {}, 'Investigación de Operaciones Studio'),
        el('p', {}, 'Resuelve problemas de Investigación de Operaciones, sigue cada cálculo y practica con tus propias matrices.'),
        el('div', { class: 'actions' }, link('Abrir el repaso de 5 horas', 'repaso', { class: 'button' }))),
      el('div', { class: 'hero-example' },
        el('p', { class: 'preview-label' }, 'Ejercicio de Transporte'),
        el('h2', {}, starter.title),
        sourceMatrix(starter.draft),
        button('Abrir Mataderos', () => openExercise('mataderos'), { class: 'primary' }))),
    el('div', { class: 'section-title' }, el('h2', {}, 'Laboratorios'),
      link('Ver biblioteca ↗', 'biblioteca')),
    el('div', { class: 'cards' },
      linearTopics.map((topic) => el('article', { class: 'card' }, el('h3', {}, lpTitles[topic]),
        el('div', { class: 'actions' }, link('Abrir ' + lpTitles[topic], lpRoutes[topic], { class: 'button' })))),
      el('article', { class: 'card' }, el('h3', {}, 'Transporte'), el('p', {}, 'Distribuye ofertas entre destinos y encuentra un reparto de costo mínimo.'),
        el('div', { class: 'actions' }, link('Abrir Transporte', 'transporte', { class: 'button' }))),
      el('article', { class: 'card' }, el('h3', {}, 'Asignación'), el('p', {}, 'Elige parejas entre tareas y recursos con el método Húngaro.'),
        el('div', { class: 'actions' }, link('Abrir Asignación', 'asignacion', { class: 'button' })))));
}

function renderReview() {
  const done = modules.filter((module) => state.completed.includes(module.id)).reduce((sum, module) => sum + module.minutes, 0);
  return el('div', {},
    pageTitle('Repaso de cinco horas', done + ' de 300 minutos en módulos completados.'),
    linearReview(),
    el('progress', { value: done, max: 300, 'aria-label': 'Progreso del repaso de cinco horas' }),
    studyControls(),
    el('div', { class: 'module-list' }, modules.map((item) =>
      el('article', { class: 'panel module-row' },
        el('div', {}, el('h2', {}, item.title), el('p', { class: 'dim' }, item.minutes + ' min')),
        el('details', {}, el('summary', {}, 'Fórmulas y conceptos'), el('p', { class: 'formula' }, item.formula)),
        el('div', { class: 'actions' },
          item.exercise && button('Estudiar', () => openExercise(item.exercise, { mode: 'learn', method: item.method })),
          item.id === 'examen' && link('Abrir examen', 'examen', { class: 'button' }),
          button(state.completed.includes(item.id) ? 'Completado' : 'Marcar completado', () => {
            const index = state.completed.indexOf(item.id);
            if (index >= 0) state.completed.splice(index, 1);
            else state.completed.push(item.id);
            save();
            render();
            document.getElementById('module-' + item.id)?.focus();
          }, { id: 'module-' + item.id, 'aria-pressed': String(state.completed.includes(item.id)) }))))));
}

function linearReview() {
  const itinerary = [
    ['fundamentos', 'Fundamentos', 15, 'graphic', 'sony'],
    ['graphic', 'Método Gráfico', 30, 'graphic', 'g3'],
    ['simplex', 'Método Simplex', 55, 'simplex', 'agricultor'],
    ['practica', 'Práctica y comprobación', 20, 'simplex', 'practica-max']
  ];
  const minutes = itinerary.reduce((total, [id, , duration]) => total + (state.lpCompleted.includes(id) ? duration : 0), 0);
  return el('section', { class: 'panel stack' }, el('h2', {}, 'Repaso de dos horas · Gráfico y Simplex'),
    el('p', {}, minutes + ' de 120 minutos en módulos completados.'),
    el('progress', { value: minutes, max: 120, 'aria-label': 'Progreso de Gráfico y Simplex' }),
    studyControls('lpStudy'),
    itinerary.map(([id, title, duration, topic, exercise]) => el('section', { class: 'module-row' },
      el('h3', {}, title + ' · ' + duration + ' min'),
      button('Estudiar', () => openLP(topic, exercise, id === 'practica' ? 'practice' : 'learn')),
      button(state.lpCompleted.includes(id) ? 'Completado' : 'Marcar completado', () => {
        state.lpCompleted = state.lpCompleted.includes(id) ? state.lpCompleted.filter((entry) => entry !== id) : [...state.lpCompleted, id];
        save(); render(); document.getElementById('lp-' + id)?.focus();
      }, { id: 'lp-' + id, 'aria-pressed': String(state.lpCompleted.includes(id)) }))));
}

function studyElapsed(key = 'study') {
  const { elapsed, started } = state[key];
  return elapsed + (started === null ? 0 : Math.max(0, Date.now() - started));
}

function studyControls(key = 'study') {
  const study = state[key];
  const started = study.started !== null;
  return el('section', { class: 'panel study-bar' },
    el('div', { class: 'field' }, el('span', {}, 'Tiempo de estudio'),
      el('output', { class: 'exam-clock', 'data-study-clock': key, 'aria-label': 'Tiempo de estudio' }, clockText(studyElapsed(key)))),
    button(started ? 'Pausar estudio' : study.elapsed ? 'Continuar estudio' : 'Iniciar estudio', () => {
      if (started) {
        study.elapsed = studyElapsed(key);
        study.started = null;
      } else study.started = Date.now();
      save();
      render();
      document.getElementById(key + '-toggle')?.focus();
    }, { id: key + '-toggle' }));
}

function expireExam() {
  if (state.exam?.finished === null && state.exam.deadline <= Date.now()) {
    finishExam(state, Date.now());
    save();
    return true;
  }
  return false;
}

setInterval(() => {
  if (expireExam() && route === 'examen') render(true);
  const clock = document.querySelector('[data-exam-clock]');
  if (clock && state.exam) clock.textContent = clockText(state.exam.deadline - Date.now());
  for (const studyClock of document.querySelectorAll('[data-study-clock]')) {
    studyClock.textContent = clockText(studyElapsed(studyClock.dataset.studyClock));
  }
}, 500);

function renderLibrary() {
  const results = el('div', { class: 'cards' });
  const query = el('input', { type: 'search', placeholder: 'Nombre, método o fuente', 'aria-label': 'Buscar ejercicios' });
  const filter = el('select', { 'aria-label': 'Filtrar por tema' },
    el('option', { value: 'all' }, 'Todos'), linearTopics.map((topic) => el('option', { value: topic }, lpTitles[topic])),
    el('option', { value: 'transport' }, 'Transporte'), el('option', { value: 'assignment' }, 'Asignación'));
  const field = (label, options) => el('select', { 'aria-label': 'Filtrar por ' + label.toLowerCase() },
    el('option', { value: 'all' }, 'Todos'), options.map(([value, caption]) => el('option', { value }, caption)));
  const method = field('Método', [...Object.entries(lpTitles), ['northwest', 'Esquina Noroeste'], ['minimum', 'Costo mínimo'],
    ['vogel', 'Vogel'], ['russell', 'Russell'], ['modi', 'MODI'], ['hungarian', 'Húngaro']]);
  const difficulty = field('Dificultad', [...new Set([...lpExercises.map(({ level }) => level),
    ...allExercises.map((exercise) => exercise.difficulty)])].map((level) => [level, level]));
  const objective = field('Objetivo', [['max', 'Maximizar'], ['min', 'Minimizar']]);
  const prerequisite = field('Conocimientos', [...new Set(lpExercises.flatMap((item) => item.prerequisites))]
    .map((name) => [name, name]));
  const accepts = (control, values) => control.value === 'all' || values.includes(control.value);
  const normalize = (text) => text.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '').toLowerCase();
  function update() {
    const word = normalize(query.value.trim());
    const linear = lpExercises.filter((item) => accepts(filter, linearTopics) && accepts(method, linearTopics) &&
      accepts(difficulty, [item.level]) && accepts(objective, item.variants.map(({ draft }) => draft.sense)) &&
      accepts(prerequisite, item.prerequisites) &&
      normalize([item.title, item.source, item.statement, 'método gráfico método simplex'].join(' ')).includes(word));
    const found = allExercises.filter((exercise) => accepts(filter, [exercise.topic]) && accepts(method, exercise.methods) &&
      accepts(prerequisite, []) &&
      accepts(difficulty, [exercise.difficulty]) && accepts(objective, [exercise.draft.objective ?? 'min']) &&
      normalize([exercise.title, exercise.source, exercise.text, ...exercise.methods].join(' ')).includes(word));
    results.replaceChildren(...linear.map((item) => el('article', { class: 'card' },
      el('p', { class: 'chip' }, item.level), el('h2', {}, item.title), lpStatement(item),
      el('p', { class: 'dim' }, 'Conocimientos previos · ' + item.prerequisites.join(' · ')),
      el('div', { class: 'actions' }, linearTopics.filter((topic) => accepts(filter, [topic]) && accepts(method, [topic])).map((topic) =>
        button(lpTitles[topic], () => openLP(topic, item.id, 'learn')))))),
    ...(found.length ? found.map((exercise) =>
      el('article', { class: 'card' },
        el('p', { class: 'chip' }, topicLabels[exercise.topic] + ' · ' + exercise.difficulty),
        el('h2', {}, exercise.title),
        exerciseStatement(exercise, { compact: true }),
        el('div', { class: 'actions' },
          button('Abrir editor', () => openExercise(exercise.id), { 'aria-label': 'Abrir ' + exercise.title }),
          button('Aprender', () => openExercise(exercise.id, { mode: 'learn', optimize: true }), { 'aria-label': 'Aprender con ' + exercise.title }),
          button('Practicar', () => openExercise(exercise.id, { mode: 'practice', optimize: true }), { 'aria-label': 'Practicar con ' + exercise.title }))
      )) : linear.length ? [] : [el('p', { role: 'status' }, 'No se encontraron ejercicios con esos filtros.')]));
  }
  query.addEventListener('input', update);
  for (const control of [filter, method, difficulty, objective, prerequisite]) control.addEventListener('change', update);
  update();
  return el('div', {}, pageTitle('Biblioteca de ejercicios', 'Problemas de las clases y las guías, con casos propios para practicar.'),
    el('div', { class: 'filter-bar' }, el('label', { class: 'field-vertical' }, 'Buscar', query),
      el('label', { class: 'field-vertical' }, 'Tema', filter),
      el('label', { class: 'field-vertical' }, 'Método', method),
      el('label', { class: 'field-vertical' }, 'Dificultad', difficulty),
      el('label', { class: 'field-vertical' }, 'Objetivo', objective),
      el('label', { class: 'field-vertical' }, 'Conocimientos', prerequisite)), results);
}

function renderLab(topic) {
  const preset = requestedExercise?.exercise?.topic === topic ? requestedExercise : null;
  requestedExercise = null;
  const fallback = getExercise(topic === 'transport' ? 'mataderos' : 'maquinas');
  const draft = state.drafts[topic] ?? (state.drafts[topic] = exerciseDraft(fallback));
  const source = preset?.exercise || getExercise(draft.exerciseId);
  const checkpoint = (method) => {
    const signature = JSON.stringify([
      draft.exerciseId, draft.rows, draft.columns, draft.costs, draft.supply, draft.demand,
      draft.fictitiousRow, draft.objective, draft.requiredRows, draft.requiredColumns, method
    ]);
    return {
      read: () => state.practice[topic]?.signature === signature ? state.practice[topic].history : [],
      write: (history) => {
        state.practice[topic] = { signature, history: structuredClone(history) };
        save();
      }
    };
  };
  const lab = topic === 'transport' ? transportLab(draft, preset ?? {}, checkpoint) : assignmentLab(draft, source, checkpoint);
  const statement = source && exerciseStatement(source, { heading: 'h2', focusable: true });
  const status = el('p', { class: 'status', role: 'status' });
  let invalidField = '';
  function update() {
    save();
    if (invalidField) document.getElementById(invalidField)?.removeAttribute('aria-invalid');
    let text;
    try {
      lab.update();
      text = topic === 'transport' ? 'Matriz y márgenes completos.' : 'Matriz de valores completa.';
      status.className = 'status';
      invalidField = '';
    } catch (error) {
      text = error.message;
      status.className = 'status error';
      invalidField = error.field;
      if (invalidField) document.getElementById(invalidField)?.setAttribute('aria-invalid', 'true');
    }
    status.textContent = text;
  }
  const rebuild = (focus) => {
    save();
    render();
    document.getElementById(focus)?.focus();
  };
  const select = el('select', { 'aria-label': 'Cambiar ejercicio' }, el('option', { value: '' }, 'Matriz propia'),
    allExercises.filter((item) => item.topic === topic).map((item) => el('option', { value: item.id }, item.title)));
  select.value = draft.exerciseId || '';
  select.addEventListener('change', () => {
    if (select.value) openExercise(select.value);
    else {
      state.drafts[topic] = {
        topic, rows: ['A', 'B'], columns: ['1', '2'], costs: [['', ''], ['', '']],
        ...(topic === 'transport' ? { supply: ['', ''], demand: ['', ''] } : { objective: 'min' })
      };
      rebuild('cell-0-0');
    }
  });
  const panel = el('section', { class: 'panel' },
    el('h2', {}, 'Matriz editable'),
    el('div', { class: 'field' }, el('label', { class: 'field' }, 'Ejercicio', select),
      source && button('Restaurar datos del ejercicio', () => openExercise(source.id))),
    topic === 'assignment' && assignmentControls(draft, update),
    editMatrix(draft, update, rebuild));
  queueMicrotask(() => {
    update();
    if (preset?.mode) {
      lab.start(preset.mode);
      statement.focus({ preventScroll: true });
      statement.scrollIntoView({ block: 'start' });
    }
  });
  return el('div', {},
    pageTitle(topicLabels[topic], source?.title || 'Matriz propia', [link('Biblioteca', 'biblioteca', { class: 'button' })]),
    statement && el('div', { class: 'panel exercise-intro' }, statement),
    el('div', { class: 'workspace' }, panel, el('aside', { class: 'stack' },
      el('section', { class: 'panel' }, el('h2', {}, 'Validación'), status, lab?.overview),
      lab?.tools,
      source && el('details', { class: 'panel source-panel' }, el('summary', {}, 'Fuente y notas'),
        el('p', { class: 'dim' }, source.source + (source.page ? ' · pág. ' + source.page : '')),
        source.note && el('p', {}, source.note)))),
    lab?.result);
}

applyTheme();
render();
if (session.invalid) announce('No se pudo leer el guardado local. Se abrió una sesión nueva.');
