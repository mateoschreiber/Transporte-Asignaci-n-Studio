import { allExercises, exerciseDraft, getExercise, modules } from '../data/exercises.js';
import { MAX_BACKUP_SIZE, parseBackup, readSession, writeSession } from '../state/progress.js';
import { announce, button, el, link, pageTitle } from './dom.js';
import { editMatrix } from './matrix.js';
import { sourceMatrix } from './table.js';
import { transportLab } from './transport-lab.js';
import { assignmentControls, assignmentLab } from './assignment-lab.js';
import { clockText, examView } from './exam.js';
import { finishExam } from '../core/assessment.js';

const main = document.querySelector('main');
const nav = document.querySelector('#navigation');
const dialog = document.querySelector('#session-dialog');
const theme = document.querySelector('#theme');
const session = readSession();
let { state, available } = session;
let route = 'inicio';
let requestedExercise = null;

const paths = { transport: 'transporte', assignment: 'asignacion' };
const topicLabels = { transport: 'Transporte', assignment: 'Asignación' };
const sections = [
  ['inicio', 'Inicio'], ['repaso', 'Repaso'], ['biblioteca', 'Biblioteca'],
  ['transporte', 'Transporte'], ['asignacion', 'Asignación'], ['examen', 'Examen']
];
const view = {
  inicio: renderHome, repaso: renderReview, biblioteca: renderLibrary,
  transporte: () => renderLab('transport'), asignacion: () => renderLab('assignment'),
  examen: () => examView(state, save, render)
};

function save() {
  available = writeSession(state);
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
        el('h1', {}, 'Transporte y Asignación'),
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
      el('article', { class: 'card' }, el('h3', {}, 'Transporte'), el('p', {}, 'Distribuye ofertas entre destinos y encuentra un reparto de costo mínimo.'),
        el('div', { class: 'actions' }, link('Abrir Transporte', 'transporte', { class: 'button' }))),
      el('article', { class: 'card' }, el('h3', {}, 'Asignación'), el('p', {}, 'Elige parejas entre tareas y recursos con el método Húngaro.'),
        el('div', { class: 'actions' }, link('Abrir Asignación', 'asignacion', { class: 'button' })))));
}

function renderReview() {
  const done = modules.filter((module) => state.completed.includes(module.id)).reduce((sum, module) => sum + module.minutes, 0);
  return el('div', {},
    pageTitle('Repaso de cinco horas', done + ' de 300 minutos en módulos completados.'),
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

function studyElapsed() {
  return state.study.elapsed + (state.study.started === null ? 0 : Math.max(0, Date.now() - state.study.started));
}

function studyControls() {
  const started = state.study.started !== null;
  return el('section', { class: 'panel study-bar' },
    el('div', { class: 'field' }, el('span', {}, 'Tiempo de estudio'),
      el('output', { class: 'exam-clock', 'data-study-clock': '', 'aria-label': 'Tiempo de estudio' }, clockText(studyElapsed()))),
    button(started ? 'Pausar estudio' : state.study.elapsed ? 'Continuar estudio' : 'Iniciar estudio', () => {
      if (started) {
        state.study.elapsed = studyElapsed();
        state.study.started = null;
      } else state.study.started = Date.now();
      save();
      render();
      document.querySelector('#study-toggle')?.focus();
    }, { id: 'study-toggle' }));
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
  const studyClock = document.querySelector('[data-study-clock]');
  if (studyClock) studyClock.textContent = clockText(studyElapsed());
}, 500);

function renderLibrary() {
  const results = el('div', { class: 'cards' });
  const query = el('input', { type: 'search', placeholder: 'Nombre, método o fuente', 'aria-label': 'Buscar ejercicios' });
  const filter = el('select', { 'aria-label': 'Filtrar por tema' },
    el('option', { value: 'all' }, 'Todos'), el('option', { value: 'transport' }, 'Transporte'), el('option', { value: 'assignment' }, 'Asignación'));
  const normalize = (text) => text.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '').toLowerCase();
  function update() {
    const word = normalize(query.value.trim());
    const found = allExercises.filter((exercise) => (filter.value === 'all' || filter.value === exercise.topic) &&
      normalize([exercise.title, exercise.source, exercise.text, ...exercise.methods].join(' ')).includes(word));
    results.replaceChildren(...(found.length ? found.map((exercise) =>
      el('article', { class: 'card' },
        el('p', { class: 'chip' }, topicLabels[exercise.topic] + ' · ' + exercise.difficulty),
        el('h2', {}, exercise.title),
        el('p', {}, exercise.text),
        el('p', { class: 'meta' }, exercise.source + (exercise.page ? ' · pág. ' + exercise.page : '')),
        el('div', { class: 'actions' },
          button('Abrir editor', () => openExercise(exercise.id), { 'aria-label': 'Abrir ' + exercise.title }),
          button('Aprender', () => openExercise(exercise.id, { mode: 'learn', optimize: true }), { 'aria-label': 'Aprender con ' + exercise.title }),
          button('Practicar', () => openExercise(exercise.id, { mode: 'practice', optimize: true }), { 'aria-label': 'Practicar con ' + exercise.title }))
      )) : [el('p', { role: 'status' }, 'No se encontraron ejercicios con esos filtros.')]));
  }
  query.addEventListener('input', update);
  filter.addEventListener('change', update);
  update();
  return el('div', {}, pageTitle('Biblioteca de ejercicios', 'Problemas de las clases y las guías, con casos propios para practicar.'),
    el('div', { class: 'filter-bar' }, el('label', { class: 'field-vertical' }, 'Buscar', query),
      el('label', { class: 'field-vertical' }, 'Tema', filter)), results);
}

function renderLab(topic) {
  const preset = requestedExercise?.exercise?.topic === topic ? requestedExercise : null;
  requestedExercise = null;
  const fallback = getExercise(topic === 'transport' ? 'mataderos' : 'maquinas');
  const draft = state.drafts[topic] ?? (state.drafts[topic] = exerciseDraft(fallback));
  const source = preset?.exercise || getExercise(draft.exerciseId);
  const lab = topic === 'transport' ? transportLab(draft, preset ?? {}) : assignmentLab(draft, source);
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
    source && el('p', { class: 'problem-text' }, source.text),
    topic === 'assignment' && assignmentControls(draft, update),
    editMatrix(draft, update, rebuild));
  queueMicrotask(() => { update(); if (preset?.mode) lab.start(preset.mode); });
  return el('div', {},
    pageTitle(topicLabels[topic], source?.title || 'Matriz propia', [link('Biblioteca', 'biblioteca', { class: 'button' })]),
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
