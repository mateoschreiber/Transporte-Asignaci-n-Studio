import { button, el } from './dom.js';

export function tracePlayer(steps, renderStep, title = 'Resolución paso a paso', { autoplay = false } = {}) {
  if (!steps.length) throw new Error('La resolución no contiene pasos.');
  let index = 0;
  const current = el('div', { class: 'step-body' });
  const live = el('p', { class: 'sr-only', 'aria-live': 'polite' });
  const back = button('← Anterior', () => go(index - 1));
  const next = button('Siguiente →', () => go(index + 1), { class: 'primary' });
  let timer = null;
  const play = button('Reproducir', () => {
    if (timer !== null) { pause(); return; }
    if (index === steps.length - 1) go(0);
    play.textContent = 'Pausar';
    timer = setInterval(() => {
      if (!current.isConnected || index === steps.length - 1) pause();
      else go(index + 1);
    }, 1600);
  });
  function pause() {
    clearInterval(timer);
    timer = null;
    play.textContent = 'Reproducir';
  }
  const reset = button('Reiniciar', () => { pause(); go(0); });
  const select = el('select', { 'aria-label': 'Seleccionar paso',
    onChange: (event) => go(Number(event.target.value)) },
  steps.map((_, i) => el('option', { value: i }, (i + 1) + ' de ' + steps.length)));
  function go(position) {
    if (position < 0 || position >= steps.length) return;
    const focused = document.activeElement;
    index = position;
    select.value = position;
    back.disabled = position === 0;
    next.disabled = position === steps.length - 1;
    current.replaceChildren(renderStep(steps[position]));
    live.textContent = 'Paso ' + (position + 1) + ' de ' + steps.length + '. ' + (current.querySelector('h3')?.textContent || '');
    if (focused?.disabled) select.focus();
  }
  go(0);
  return el('section', { class: 'panel trace-panel', 'aria-label': title },
    el('div', { class: 'trace-header' }, el('h2', {}, title), el('div', { class: 'actions' }, autoplay && play, reset)),
    el('div', { class: 'trace-controls' }, back, el('label', { class: 'field' }, 'Paso', select), next),
    current,
    live);
}

export function operation(title, reason, formula, result, next) {
  return el('div', { class: 'operation' }, el('h3', {}, title),
    el('p', {}, reason), formula && el('p', { class: 'formula' }, formula),
    result && el('p', { class: 'step-result' }, result), next && el('p', { class: 'dim' }, next));
}
