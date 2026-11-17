import { numberAtScale } from '../core/input.js';
import { button, el } from './dom.js';

export function practicePanel(makeSession, solution) {
  let session = makeSession();
  let position = 0;
  const body = el('div', { class: 'stack' });
  const panel = el('section', { class: 'panel practice-panel', 'aria-label': 'Practicar paso a paso' },
    el('div', { class: 'trace-header' }, el('h2', {}, 'Practicar paso a paso'),
      el('div', { class: 'actions' },
        button('Reiniciar', () => { session = makeSession(); position = 0; render(true); }),
        button('Ver resolución', solution))),
    body);
  function render(focus = false) {
    const task = session.next();
    if (task.complete) {
      body.replaceChildren(task.complete);
      if (focus) body.querySelector('h3')?.focus();
      return;
    }
    let hintIndex = 0;
    const feedback = el('p', { id: 'practice-feedback', class: 'feedback', role: 'status' });
    const hint = el('p', { class: 'hint-text', role: 'status' });
    const heading = el('h3', { tabindex: '-1' }, task.title);
    const proceed = button('Continuar →', () => { task.proceed(); position++; render(true); }, { class: 'primary', hidden: true });
    const check = button('Comprobar', () => {
      let issue;
      try {
        issue = task.validate();
      } catch (error) {
        issue = error.message;
      }
      feedback.className = 'status ' + (issue ? 'error' : '');
      feedback.textContent = issue || 'Correcto. Puedes continuar con el siguiente paso.';
      if (!issue) {
        check.disabled = true;
        proceed.hidden = false;
        proceed.focus();
      }
    }, { class: 'primary' });
    const hintButton = button('Pista', () => {
      hint.textContent = task.hints[hintIndex++];
      hintButton.disabled = hintIndex >= task.hints.length;
    });
    // A correct answer can be advanced, or rechecked if the student edits it.
    function changed() {
      if (proceed.hidden) return;
      proceed.hidden = true;
      feedback.textContent = '';
      feedback.className = 'feedback';
      check.disabled = false;
    }
    const fields = el('div', { class: 'practice-fields' }, task.fields, task.scene);
    for (const event of ['input', 'change', 'click']) fields.addEventListener(event, changed);
    fields.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement &&
          event.target.type !== 'checkbox' && !check.disabled) {
        event.preventDefault();
        check.click();
      }
    });
    body.replaceChildren(el('p', { class: 'dim step-counter' }, 'Operación ' + (position + 1)),
      heading, el('p', {}, task.prompt), fields,
      el('div', { class: 'actions' }, check, hintButton, proceed), feedback, hint);
    if (focus) heading.focus();
  }
  render();
  return panel;
}

export function numericFields(items) {
  const fields = items.map((item) => {
    const input = el('input', { type: 'text', inputmode: 'decimal', maxlength: 24, 'aria-describedby': 'practice-feedback' });
    return { ...item, input, labelNode: el('label', { class: 'field-vertical' }, item.label, input) };
  });
  return {
    fields: el('div', { class: 'answer-grid' }, fields.map(({ labelNode }) => labelNode)),
    validate: () => {
      for (const item of fields) {
        item.input.removeAttribute('aria-invalid');
        let value;
        try {
          value = numberAtScale(item.input.value, item.scale, item.label);
        } catch (error) {
          item.input.setAttribute('aria-invalid', 'true');
          return error.message;
        }
        if (value !== item.answer) {
          item.input.setAttribute('aria-invalid', 'true');
          return 'Revisa el cálculo de «' + item.label + '».';
        }
      }
      return null;
    }
  };
}

export function choiceField(label, options, valid) {
  const select = el('select', {}, el('option', { value: '' }, 'Selecciona…'),
    options.map(([value, text]) => el('option', { value }, text)));
  return {
    fields: el('label', { class: 'field-vertical choice-field' }, label, select),
    value: () => select.value,
    validate: () => valid(select.value) ? null : 'Revisa la opción seleccionada.'
  };
}

export function cellSelection(table, { multiple = false, ordered = false, initial = [] } = {}) {
  const selections = [...initial];
  const description = el('p', { class: 'dim', 'aria-live': 'polite' });
  const key = (i, j) => i + '-' + j;
  const scene = table((i, j) => {
    const existing = selections.findIndex((item) => item.i === i && item.j === j);
    if (!multiple) selections.splice(0);
    else if (existing >= 0) selections.splice(existing, 1);
    if (!multiple || existing < 0) selections.push({ i, j });
    draw();
  });
  function draw() {
    const keys = selections.map(({ i, j }) => key(i, j));
    scene.querySelectorAll('td[data-cell] button').forEach((item) => {
      const match = keys.indexOf(item.closest('td').dataset.cell);
      item.setAttribute('aria-pressed', String(match >= 0));
      item.querySelector('.selection-order')?.remove();
      if (ordered && match >= 0) item.append(el('span', { class: 'selection-order' }, String(match + 1)));
    });
    description.textContent = multiple ? 'Celdas seleccionadas: ' + selections.length :
      selections.length ? 'Selección: fila ' + (selections[0].i + 1) + ', columna ' + (selections[0].j + 1) + '.' :
        'Selecciona una celda en la matriz.';
  }
  draw();
  return { scene: el('div', { class: 'stack' }, scene, description), selections };
}
