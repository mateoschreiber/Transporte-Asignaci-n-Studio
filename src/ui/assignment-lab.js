import { assignmentModel } from '../core/assignment-model.js';
import { solveHungarian } from '../core/hungarian.js';
import { exerciseDraft, getExercise } from '../data/exercises.js';
import { button, el, number } from './dom.js';
import { assignmentShape, assignmentStep } from './assignment.js';
import { tracePlayer } from './trace.js';
import { practicePanel } from './practice.js';
import { assignmentPractice } from './assignment-practice.js';

export function assignmentControls(draft, update) {
  const objective = el('select', { 'aria-label': 'Objetivo de Asignación' },
    el('option', { value: 'min' }, 'Minimizar costo'), el('option', { value: 'max' }, 'Maximizar beneficio'));
  objective.value = draft.objective;
  objective.addEventListener('change', () => { draft.objective = objective.value; update(); });
  const axis = draft.rows.length > draft.columns.length ? 'rows' : 'columns';
  const rectangular = draft.rows.length !== draft.columns.length;
  const key = axis === 'rows' ? 'requiredRows' : 'requiredColumns';
  const items = draft[axis];
  return el('div', { class: 'problem-options' },
    el('label', { class: 'field' }, 'Objetivo', objective),
    rectangular && el('details', {}, el('summary', {}, 'Elegir elementos obligatorios'),
      el('p', { class: 'dim' }, 'El lado menor queda cubierto. Marca los elementos del lado mayor que también deban tener pareja real.'),
      el('div', { class: 'checkbox-grid' }, items.map((name, i) => {
        const checkbox = el('input', { type: 'checkbox',
          checked: Boolean(draft[key]?.[i]),
          onChange: (event) => {
            draft[key] ??= Array(items.length).fill(false);
            draft[key][i] = event.target.checked;
            update();
          }
        });
        return el('label', { class: 'field' }, checkbox, name || (i + 1));
      }))));
}

export function assignmentLab(draft, source, checkpoint) {
  let model;
  const overview = el('div', { class: 'stack' });
  const result = el('div', { class: 'stack lab-result', tabindex: '-1' });
  function solution() {
    const computed = solveHungarian(model);
    return tracePlayer(computed.steps, (step) => assignmentStep(model, step), 'Método Húngaro');
  }
  const solve = button('Aprender', () => { overview.hidden = false; show(solution()); }, { class: 'primary' });
  const practice = button('Practicar', () => {
    overview.hidden = true;
    const panel = practicePanel(() => assignmentPractice(model),
      () => show(button('Volver a la práctica', () => show(panel), { class: 'return-practice' }), solution()),
      checkpoint?.('hungarian'));
    show(panel);
  });
  const compare = source?.compareWith && button('Comparar con JobShop original', () => {
    overview.hidden = false;
    const baseline = assignmentModel(exerciseDraft(getExercise(source.compareWith)));
    const scenarios = [[baseline, solveHungarian(baseline)], [model, solveHungarian(model)]];
    const [old, current] = scenarios.map(([scenario, outcome]) =>
      outcome.status === 'optimal' ? number(outcome.z, scenario.costScale) : 'Infactible');
    show(el('section', { class: 'panel stack' }, el('h2', {}, 'Comparación de escenarios'),
      el('dl', { class: 'totals' },
        el('div', {}, el('dt', {}, 'Puestos originales'), el('dd', {}, old)),
        el('div', {}, el('dt', {}, 'Escenario actual'), el('dd', {}, current))),
      scenarios[1][1].status === 'optimal' && el('ul', { class: 'pair-list' }, scenarios[1][1].pairs.map(({ i, j }) =>
        el('li', {}, model.rows[i] + ' → ' + model.columns[j])))));
  });
  function show(...nodes) {
    result.replaceChildren(...nodes);
    result.focus({ preventScroll: true });
    result.scrollIntoView({ block: 'start' });
  }
  return {
    overview, result, start: (mode) => (mode === 'practice' ? practice : solve).click(),
    tools: el('section', { class: 'panel' }, el('h2', {}, 'Resolver Asignación'),
      el('div', { class: 'actions' }, solve, practice, compare)),
    update() {
      result.replaceChildren();
      overview.hidden = false;
      overview.replaceChildren();
      solve.disabled = true;
      practice.disabled = true;
      if (compare) compare.disabled = true;
      model = assignmentModel(draft);
      overview.replaceChildren(el('p', { class: 'status' }, assignmentShape(model)),
        el('p', { class: 'formula' }, (model.objective === 'max' ? 'Max' : 'Min') + ' Z = Σᵢ Σⱼ Cᵢⱼ Xᵢⱼ · Xᵢⱼ ∈ {0,1}'));
      solve.disabled = false;
      practice.disabled = false;
      if (compare) compare.disabled = false;
    }
  };
}
