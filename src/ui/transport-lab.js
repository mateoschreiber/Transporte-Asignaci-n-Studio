import { transportModel } from '../core/transport-model.js';
import { initialMethods, solveInitial } from '../core/transport-initial.js';
import { solveModi } from '../core/modi.js';
import { methodNames } from '../data/exercises.js';
import { button, el, number } from './dom.js';
import { balanceStep, transportStep, transportSummary } from './transport.js';
import { tracePlayer } from './trace.js';
import { practicePanel } from './practice.js';
import { transportPractice } from './transport-practice.js';

export function transportLab(draft, preset = {}) {
  const overview = el('div', { class: 'stack' });
  const result = el('div', { class: 'stack lab-result', tabindex: '-1' });
  const method = el('select', { 'aria-label': 'Método de Transporte' },
    initialMethods.map((key) => el('option', { value: key }, methodNames[key])));
  const optimize = el('input', { type: 'checkbox', 'aria-label': 'Optimizar con MODI' });
  if (initialMethods.includes(preset.method)) method.value = preset.method;
  optimize.checked = preset.method === 'modi' || Boolean(preset.optimize);
  function solution() {
    const initial = solveInitial(model, method.value);
    const optimal = optimize.checked && initial.status === 'feasible' ? solveModi(model, initial.state) : null;
    return tracePlayer([balanceStep(model), ...initial.steps, ...(optimal?.steps || [])],
      (step) => transportStep(model, step), methodNames[method.value] + (optimal ? ' + MODI' : ''));
  }
  function show(...nodes) {
    result.replaceChildren(...nodes);
    result.focus({ preventScroll: true });
    result.scrollIntoView({ block: 'start' });
  }
  const solve = button('Aprender', () => { overview.hidden = false; show(solution()); }, { class: 'primary' });
  const practice = button('Practicar', () => {
    overview.hidden = true;
    const panel = practicePanel(() => transportPractice(model, method.value, optimize.checked),
      () => show(button('Volver a la práctica', () => show(panel), { class: 'return-practice' }), solution()));
    show(panel);
  });
  const compare = button('Comparar SBF', () => {
    overview.hidden = false;
    const rows = initialMethods.map((key) => {
      const solved = solveInitial(model, key);
      return el('tr', {}, el('th', { scope: 'row' }, methodNames[key]),
        el('td', {}, solved.status === 'feasible' ? number(solved.z, model.objectiveScale) : 'Infactible'));
    });
    show(el('section', { class: 'panel' }, el('h2', {}, 'Costo de las SBF iniciales'),
      el('table', { class: 'matrix' }, el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Método'), el('th', { scope: 'col' }, 'Z'))),
      el('tbody', {}, rows))));
  });
  let model;
  const tools = el('section', { class: 'panel' }, el('h2', {}, 'Resolver Transporte'),
    el('div', { class: 'stack' }, el('label', { class: 'field-vertical' }, 'Método inicial', method),
      el('label', { class: 'field' }, optimize, 'Optimizar con MODI'),
      el('div', { class: 'actions' }, solve, practice, compare)));
  function clearResult() {
    result.replaceChildren();
    overview.hidden = false;
  }
  method.addEventListener('change', clearResult);
  optimize.addEventListener('change', clearResult);
  return {
    overview, tools, result, start: (mode) => (mode === 'practice' ? practice : solve).click(),
    update() {
      clearResult();
      model = null;
      solve.disabled = true;
      practice.disabled = true;
      compare.disabled = true;
      overview.replaceChildren();
      model = transportModel(draft);
      overview.replaceChildren(transportSummary(model));
      solve.disabled = false;
      practice.disabled = false;
      compare.disabled = false;
    }
  };
}
