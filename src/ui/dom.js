export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key === 'value') node.value = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const button = (label, action, attributes = {}) =>
  el('button', { type: 'button', onClick: action, ...attributes }, label);

export const link = (label, route, attributes = {}) =>
  el('a', { href: '#' + route, tabindex: '0', ...attributes }, label);

export function number(value, scale = 1) {
  const precision = Math.round(Math.log10(scale));
  return (value / scale).toLocaleString('es-PY', {
    maximumFractionDigits: Math.min(precision, 20),
    useGrouping: false
  });
}

export function pageTitle(title, sub, actions = []) {
  return el('header', { class: 'page-heading' }, el('div', {},
    el('h1', {}, title), sub && el('p', {}, sub)),
  actions.length > 0 && el('div', { class: 'actions' }, actions));
}

export function announce(text) {
  document.querySelector('#announcements').textContent = text;
}
