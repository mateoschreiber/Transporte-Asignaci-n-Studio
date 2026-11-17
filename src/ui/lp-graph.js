import { el, button } from './dom.js';
import { divide, formatRational as f } from '../core/rational.js';
import { dot } from '../core/lp.js';

const numeric = ({ numerator, denominator }) => Number(numerator) / Number(denominator);
const coordinates = (point) => '(' + point.map(f).join(', ') + ')';

function svgNode(name, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}

export function plotLP(model, result, { level = 4, path = [] } = {}) {
  const plot = svgNode('svg', { viewBox: '0 0 520 360', role: 'img', 'aria-label': 'Gráfico cartesiano del modelo', class: 'lp-plot' });
  const reference = [result.point, ...result.vertices, ...path].filter(Boolean).map((point) => point.map(numeric));
  const typical = Math.max(1, ...reference.flat().map(Math.abs));
  let zoom = 1;
  function draw() {
    const scale = typical * 1.25 / zoom;
    const dx = 220 / scale;
    const dy = 140 / scale;
    const position = ([x, y]) => [260 + dx * x, 180 - dy * y];
    const pointString = (point) => position(point).join(',');
    const bounds = [[-scale, -scale], [scale, -scale], [scale, scale], [-scale, scale]];
    const rows = result.planes.map(({ coefficients, bound }) => [...coefficients.map(numeric), numeric(bound)]);
    function clip(polygon, [a, b, c]) {
      const clipped = [];
      const signed = ([x, y]) => a * x + b * y - c;
      polygon.forEach((point, i) => {
        const previous = polygon[(i + polygon.length - 1) % polygon.length];
        const u = signed(previous);
        const v = signed(point);
        if ((u > 0) !== (v > 0)) {
          const t = u / (u - v);
          clipped.push(previous.map((value, j) => value + t * (point[j] - value)));
        }
        if (v <= 0) clipped.push(point);
      });
      return clipped;
    }
    const feasible = level >= 2 && result.status !== 'infeasible' ? rows.reduce(clip, bounds) : [];
    const axis = ([x1, y1], [x2, y2], className) => svgNode('line', { x1, y1, x2, y2, class: className });
    function line([a, b, c], className) {
      const points = [];
      if (b !== 0) for (const x of [-scale, scale]) points.push([x, (c - a * x) / b]);
      if (a !== 0) for (const y of [-scale, scale]) points.push([(c - b * y) / a, y]);
      const visible = points.filter(([x, y]) => Math.abs(x) <= scale * 1.000001 && Math.abs(y) <= scale * 1.000001);
      return visible.length >= 2 ? axis(...visible.slice(0, 2).map(position), className) : null;
    }
    const elements = [
      axis([28, 180], [493, 180], 'lp-axis'), axis([260, 22], [260, 334], 'lp-axis'),
      svgNode('text', { x: 494, y: 173 }, model.variables[0].name),
      svgNode('text', { x: 270, y: 31 }, model.variables[1].name),
      svgNode('text', { x: 246, y: 195 }, '0'),
      svgNode('text', { x: 40, y: 350 }, 'Escala ≈ ' + scale.toPrecision(3))
    ];
    if (feasible.length) elements.push(svgNode('polygon', { points: feasible.map(pointString).join(' '), class: 'lp-region' }));
    if (level >= 1) elements.push(...rows.map((row) => line(row, 'lp-boundary')).filter(Boolean));
    if (level >= 3 && result.value) {
      const objective = line([...model.objective.map(numeric), numeric(result.value)], 'lp-objective');
      if (objective) elements.push(objective);
    }
    if (level >= 3 && result.ray) {
      const origin = result.point.map(numeric);
      const direction = result.ray.map(numeric);
      const magnitude = Math.max(...direction.map(Math.abs));
      const end = origin.map((value, j) => value + direction[j] * scale / (2 * magnitude));
      if (end.every((coordinate) => Math.abs(coordinate) <= scale)) elements.push(axis(position(origin), position(end), 'lp-objective'));
    }
    if (path.length > 1) {
      elements.push(svgNode('polyline', { points: path.map((point) => pointString(point.map(numeric))).join(' '), class: 'lp-path' }));
    }
    const displayed = level >= 2 ? result.vertices : [];
    for (const point of [...displayed, ...(level >= 3 && result.point ? [result.point] : [])]) {
      const [cx, cy] = position(point.map(numeric));
      if (cx < 0 || cx > 520 || cy < 0 || cy > 360) continue;
      const marker = svgNode('circle', { cx, cy, r: 5, class: 'lp-point' });
      marker.append(svgNode('title', {}, coordinates(point)));
      elements.push(marker);
    }
    plot.replaceChildren(...elements);
  }
  function adjust(value) {
    zoom = Math.min(64, Math.max(1 / 16, value));
    draw();
  }
  draw();
  return el('div', { class: 'stack' }, plot, el('div', { class: 'actions' },
    button('Acercar', () => adjust(zoom * 2)), button('Alejar', () => adjust(zoom / 2)),
    button('Restablecer escala', () => adjust(1))));
}

export function graphTrace(model, result) {
  const constraints = model.constraints.map(({ id, coefficients, bound, operator }) =>
    id + ' · ' + coefficients.map((value, i) => f(value) + '·' + model.variables[i].name).join(' + ') + ' ' + operator + ' ' + f(bound));
  const cuts = model.constraints.map(({ id, coefficients, bound }) => ({
    id, cuts: coefficients.map((coefficient) => coefficient.numerator
      ? f(divide(bound, coefficient))
      : bound.numerator ? 'sin corte único' : 'eje contenido')
  }));
  const projected = result.projectedVariable === 'X' ? model.variables[0].name : 'Z';
  const projection = result.contradiction
    ? result.contradiction.map(([a, b, sources]) => sources.map(({ plane, factor }) => f(factor) + '·' + plane.id)
      .join(' + ') + ' → ' + f(a) + '·' + projected + ' ≤ ' + f(b)).join(' | ')
    : result.projection
      ? (result.projection.lower ? f(result.projection.lower) + ' ≤ ' : '') + 'Z' +
        (result.projection.upper ? ' ≤ ' + f(result.projection.upper) : '') +
        (!result.projection.lower && !result.projection.upper ? ' puede tomar cualquier valor real.' : '')
      : 'Z = 0 en toda la región factible.';
  return [
    ['Variables y objetivo', model.variables.map(({ name, domain }) => name + ' (' + { free: 'libre', positive: '≥ 0', negative: '≤ 0' }[domain] + ')').join(' · '),
      (model.sense === 'max' ? 'Máx' : 'Mín') + ' Z = ' + model.objective.map((v, j) => f(v) + '·' + model.variables[j].name).join(' + '), 0],
    ['Rectas y restricciones', 'Traza las rectas sustituyendo los operadores por igualdad.', constraints.join(' | '), 1],
    ['Cortes con los ejes', 'Para cada corte se fija la otra coordenada en cero.', cuts.map(({ id, cuts }) => id + ': ' + cuts.join(' y ')).join(' | '), 1],
    ['Semiplanos y región factible', 'La región se obtiene al intersectar las restricciones y los dominios.',
      result.status === 'infeasible' ? 'Intersección vacía.' :
        result.recession.length ? 'Región no acotada.' : 'Región acotada.', 2],
    ['Vértices y valor objetivo', 'Solo se evalúan las intersecciones factibles.',
      result.vertices.map((point) => coordinates(point) + ' → Z = ' + f(dot(model.objective, point)) +
        (result.degenerateVertices?.includes(point) ? ' · más de dos ligaduras activas' : '')).join(' | ') || 'No hay vértices.', 2],
    ['Proyección del objetivo', 'Combina cotas inferiores y superiores mediante Fourier–Motzkin para eliminar una coordenada.',
      projection, 2],
    ['Interpretación', 'El valor se obtiene sobre la región matemática completa.',
      result.status === 'optimal' ? 'Z = ' + f(result.value) + ' en ' + coordinates(result.point) :
        result.status === 'unbounded' ? 'Rayo de mejora ' + coordinates(result.ray) : 'Modelo infactible.', 3]
  ];
}
