import { lpExercises } from '../data/lp-exercises.js';
import { add, compare, divide, formatRational as f, multiply, parseRational, subtract } from '../core/rational.js';
import { dot, dualLP, flip, one, parseLP, validPoint } from '../core/lp.js';
import { solveGraphical } from '../core/graphical.js';
import { simplexSteps, solveSimplex } from '../core/simplex.js';
import { certifyDualPair, diagnoseSimplex } from '../core/lp-certificates.js';
import { el, button, link, pageTitle } from './dom.js';
import { graphTrace, plotLP } from './lp-graph.js';
import { simplexStep } from './lp-table.js';
import { operation, tracePlayer } from './trace.js';

export const lpTitles = { graphic: 'Método Gráfico', simplex: 'Método Simplex' };
export const lpRoutes = { graphic: 'grafico', simplex: 'simplex' };
const point = (values) => '(' + values.map(f).join(', ') + ')';
const relation = { '<=': '≤', '>=': '≥', '=': '=' };

export function lpStatement(item) {
  const [head, ...rows] = item.sourceTable ?? [];
  const lines = item.statement.split('\n');
  const prompt = head && lines.pop();
  return el('section', { class: 'panel stack' }, el('h2', {}, 'Enunciado original'),
    lines.map((line) => el('p', {}, line)),
    head && el('div', { class: 'matrix-scroll', tabindex: '0', role: 'region', 'aria-label': 'Tabla del enunciado' },
      el('table', { class: 'matrix' },
        el('thead', {}, el('tr', {}, head.map((label) => el('th', { scope: 'col' }, label)))),
        el('tbody', {}, rows.map(([label, ...values]) => el('tr', {},
          el('th', { scope: 'row' }, label), values.map((value) => el('td', {}, value))))))),
    prompt && el('p', {}, prompt),
    el('p', { class: 'dim' }, item.source + ', p. ' + item.page + (item.other ? ' · ' + item.other : '')),
    item.id === 'g4' && plotLP(parseLP(item.variants[0].draft), solveGraphical(parseLP(item.variants[0].draft)), { level: 2 }));
}

export function modelFormulas(model) {
  function terms(values) {
    return values.map((value, i) => f(value) + '·' + model.variables[i].name).join(' + ');
  }
  return el('div', { class: 'formula' },
    el('p', {}, (model.sense === 'max' ? 'Máx' : 'Mín') + ' Z = ' + terms(model.objective)),
    model.constraints.map((row) => el('p', {}, row.id + ' · ' + terms(row.coefficients) + ' ' + relation[row.operator] + ' ' + f(row.bound))),
    el('p', {}, model.variables.map(({ name, domain }) =>
      name + ' ' + ({ positive: '≥ 0', negative: '≤ 0', free: 'libre' })[domain]).join(' · ')));
}

function resultSummary(model, result) {
  if (result.status === 'infeasible') return el('div', { class: 'stack' },
    el('p', { class: 'status error' }, result.residual
      ? 'Modelo infactible. Suma mínima de artificiales = ' + f(result.residual) + '.'
      : 'Modelo infactible. No hay punto común a todos los semiplanos.'),
    result.certificate && el('p', { class: 'formula' }, 'Certificado · ' +
      result.certificate.multipliers.map((value, i) => '(' + f(value) + ')·' + model.constraints[i].id).join(' + ') +
      ' exige ' + result.certificate.coefficients.map((value, j) => f(value) + '·' + model.variables[j].name).join(' + ') +
      ' ≥ ' + f(result.certificate.bound) + ', mientras que los dominios limitan esa expresión a valores ≤ 0.'));
  if (result.status === 'unbounded') return el('p', { class: 'status caution' },
    'Objetivo no acotado. Punto factible ' + point(result.point) + ' y dirección de mejora ' + point(result.ray) + '.');
  return el('div', { class: 'stack' },
    el('p', { class: 'status' }, 'Óptimo · ' + point(result.point) + ' · Z = ' + f(result.value)),
    result.alternative && el('p', {}, 'Otro óptimo es ' + point(result.alternative) + '.'),
    result.optimalRay && el('p', {}, 'Dirección óptima de costo constante ' + point(result.optimalRay) + '.'),
    el('ul', {}, model.constraints.map((row) => {
      const activity = dot(row.coefficients, result.point);
      const slack = row.operator === '>=' ? subtract(activity, row.bound) : subtract(row.bound, activity);
      return el('li', {}, row.id + ' · ' + (!slack.numerator ? 'Activa' : 'Holgura o exceso ' + f(slack)) +
        (result.redundant?.includes(row.id) ? ' · Redundante' : ''));
    })));
}

function input(label, value, update) {
  return el('label', { class: 'field-vertical' }, label,
    el('input', { value, maxlength: 80, onInput: (event) => update(event.target.value) }));
}

function select(label, entries, value, update) {
  const field = el('select', { 'aria-label': label, onChange: (event) => update(event.target.value) },
    entries.map(([key, text]) => el('option', { value: key }, text)));
  field.value = value;
  return el('label', { class: 'field-vertical' }, label, field);
}

export function graphPlayer(model, result) {
  const steps = graphTrace(model, result);
  return tracePlayer(steps, ([title, reason, formula, level]) => el('div', { class: 'step-grid' },
    plotLP(model, result, { level }), operation(title, reason, formula)), 'Método Gráfico paso a paso', { autoplay: true });
}

function equivalentRestriction(answer, values, operator) {
  const [left, right, relationText, bound, ...extra] = answer.trim().split(/\s*\|\s*/);
  if (extra.length || !bound || !['<=', '>=', '='].includes(relationText)) return false;
  const terms = [left, right, bound].map(parseRational);
  const base = values.findIndex((value) => value.numerator);
  if (base < 0) return relationText === operator && terms.every((value) => !value.numerator);
  const scale = divide(terms[base], values[base]);
  if (!scale.numerator) return false;
  return relationText === (scale.numerator < 0n ? flip(operator) : operator) &&
    values.every((value, j) => compare(multiply(value, scale), terms[j]) === 0);
}

function practice(model, result, topic, checkpoint, save, onBranch) {
  const questions = [];
  if (topic === 'graphic') {
    model.variables.forEach(({ name, domain }, j) => {
      questions.push(['Dominio de ' + name + ' · 1 no negativa, 2 no positiva, 3 libre',
        parseRational({ positive: 1, negative: 2, free: 3 }[domain]), 'Consulta el enunciado.',
        'Identifica si la variable representa una cantidad o una coordenada libre.']);
      questions.push(['Coeficiente de ' + name + ' en Z', model.objective[j],
        'Identifica la contribución por unidad.', 'En la función objetivo, busca el factor que multiplica esta variable.']);
    });
    for (const { id, operator, coefficients, bound } of model.constraints) {
      questions.push([id + ' · Escribe coeficiente de ' + model.variables[0].name + ' | coeficiente de ' +
        model.variables[1].name + ' | operador (<=, >=, =) | término independiente',
        (answer) => equivalentRestriction(answer, [...coefficients, bound], operator),
        'Extrae los coeficientes y la cota de esta ligadura.',
        'Puedes multiplicar todos los términos por el mismo factor. Con un factor negativo, invierte la desigualdad.']);
      questions.push([id + ' · Semiplano: 1 ≤, 2 ≥, 3 recta',
        parseRational({ '<=': 1, '>=': 2, '=': 3 }[operator]), 'Identifica si hay un máximo permitido o un requisito mínimo.',
        'Un punto de prueba satisface la desigualdad si está en el semiplano elegido.']);
      coefficients.forEach((coefficient, i) => {
        if (coefficient.numerator) questions.push([id + ' · Corte con ' + model.variables[i].name,
          divide(bound, coefficient), 'Fija la otra coordenada en cero.', 'Divide el término independiente entre el coeficiente del eje.']);
      });
    }
    if (result.point) {
      const coordinates = result.point.map(f).join(', ');
      const probe = [add(result.point[0], one), result.point[1]];
      questions.push(['¿Pertenece (' + probe.map(f).join(', ') + ') a la región factible? · 1 Sí, 2 No',
        parseRational(validPoint(model, probe) ? 1 : 2), 'Evalúa cada ligadura en el punto dado.', 'Comprueba también el dominio de cada coordenada.']);
      if (result.status === 'optimal') questions.push(['Evalúa Z en el punto óptimo (' + coordinates + ')', result.value,
        'Multiplica cada coordenada por el coeficiente del objetivo.', 'Suma los dos productos.']);
    }
  } else {
    for (const step of result.steps.filter(({ kind }) => kind === 'pivot')) {
      const entering = step.columns[step.entering].name;
      questions.push(['Columna entrante · índice en la tabla', parseRational(step.entering + 1), 'Calcula la fila Zj−Cj.',
        'Aplica el criterio de mejora de esta fase.', step, 'entering']);
      questions.push(['Zj de ' + entering + (step.phase === 1 ? ' · coeficiente de M' : ''),
        step.phase === 1 ? step.mj[step.entering] : step.zj[step.entering],
        'Multiplica cada coeficiente de la columna por Ck.', 'Suma los productos de las variables básicas.', step]);
      questions.push(['Fila saliente · índice entre las filas básicas', parseRational(step.leaving + 1),
        'Compara los cocientes de la entrante.', 'Descarta los cocientes de las filas con coeficientes no positivos.', step, 'leaving']);
      questions.push(['Cociente de la fila saliente', step.ratios[step.leaving], 'Divide Bk entre el coeficiente en la columna entrante.', 'El menor cociente válido determina la salida.', step]);
      questions.push(['Pivote en la columna ' + entering, step.pivotValue, 'El pivote está en la intersección de la entrante y la fila de menor cociente.', 'Solo cuentan los coeficientes positivos.', step]);
      questions.push(['Bk de la fila pivote normalizada', step.normalized.bound,
        'Divide toda la fila por el pivote.', 'Aplica la misma división al término independiente.', step]);
      const other = step.rows.findIndex((_, i) => i !== step.leaving);
      if (other >= 0) questions.push(['Nuevo Bk de la fila ' + (other + 1), step.rows[other].bound,
        'Utiliza la fila pivote normalizada.', 'Resta el coeficiente de la columna entrante multiplicado por el Bk normalizado.', step]);
    }
  }
  if (topic === 'simplex' && result.status === 'optimal') questions.push(['Valor óptimo de Z', result.value, 'Evalúa la función objetivo.', 'Sustituye las variables básicas en el objetivo original.']);
  questions.push(['Clasificación · 1 óptimo, 2 infactible, 3 no acotado',
    parseRational({ optimal: 1, infeasible: 2, unbounded: 3 }[result.status]), 'Comprueba primero la factibilidad.', 'Distingue entre un extremo finito y una dirección de mejora ilimitada.']);
  const box = el('div', { class: 'panel stack' });
  let index = Math.min(checkpoint.step ?? 0, questions.length);
  function show() {
    if (index === questions.length) {
      box.replaceChildren(el('h2', {}, 'Práctica terminada'), resultSummary(model, result),
        button('Reiniciar práctica', () => { checkpoint.step = 0; checkpoint.choices = []; save(); onBranch(); }));
      return;
    }
    const [title, expected, first, second, table, choice] = questions[index];
    let hints = 0;
    const status = el('p', { role: 'status' });
    const answer = el('input', { 'aria-label': title, maxlength: 80 });
    const reference = table && simplexStep({ ...table, kind: 'table', rows: table.before, basis: table.previousBasis, entering: undefined,
      leaving: undefined, ratios: undefined, before: undefined, value: undefined, zj: undefined });
    box.replaceChildren(el('h2', {}, 'Práctica'), el('p', {}, 'Paso ' + (index + 1) + ' de ' + questions.length), reference,
      el('label', { class: 'field-vertical' }, title, answer),
      el('div', { class: 'actions' }, button('Comprobar', () => {
        try {
          let selected;
          let valid;
          if (typeof expected === 'function') valid = expected(answer.value);
          else {
            const entered = parseRational(answer.value);
            selected = entered.denominator === 1n ? Number(entered.numerator) - 1 : -1;
            const difference = subtract(entered, expected);
            const error = Number(difference.numerator) / Number(difference.denominator);
            valid = choice ? table[choice + 'Options'].includes(selected) :
              difference.numerator === 0n || Math.abs(error) <= 0.00005;
          }
          if (!valid) {
            status.textContent = 'Revisa el cálculo y vuelve a intentarlo.';
            return;
          }
          checkpoint.step = ++index;
          if (choice && selected !== table[choice]) {
            checkpoint.choices ??= [];
            checkpoint.choices[table.iteration] = {
              ...checkpoint.choices[table.iteration], [choice]: selected
            };
            save();
            onBranch();
            return;
          }
          save();
          show();
          box.querySelector('input')?.focus();
        } catch (error) { status.textContent = error.message; }
      }), button('Pista', () => { status.textContent = hints++ ? second : first; })), status);
  }
  show();
  return box;
}

export function lpLab(topic, state, save, render, go, requestedMode) {
  const saved = state.linear[topic] ??= { exercise: 'sony', variant: 0, mode: 'learn',
    draft: structuredClone(lpExercises.find(({ id }) => id === 'sony').variants[0].draft), step: 0 };
  if (requestedMode) saved.mode = requestedMode;
  const item = lpExercises.find(({ id }) => id === saved.exercise);
  const draft = saved.draft;
  const graphical = topic === 'graphic';
  const output = el('div', { class: 'stack' });
  const preview = el('div', { class: 'stack' });
  const error = el('p', { class: 'status error', role: 'status', hidden: true });
  let generation = 0;
  function changed() {
    generation++;
    saved.step = 0;
    saved.choices = [];
    save();
    output.replaceChildren();
    updatePreview();
  }
  function updatePreview() {
    try {
      const parsed = parseLP(draft);
      preview.replaceChildren(modelFormulas(parsed),
        graphical && plotLP(parsed, solveGraphical(parsed), { level: saved.mode === 'practice' ? 1 : 2 }));
      error.hidden = true;
    } catch (failure) {
      preview.replaceChildren();
      error.hidden = false;
      error.textContent = failure.message;
    }
  }
  async function calculate() {
    const ticket = ++generation;
    try {
      const parsed = parseLP(draft);
      let result;
      if (graphical) result = solveGraphical(parsed);
      else {
        const iterator = simplexSteps(parsed, saved.mode === 'practice' ? saved.choices : undefined);
        const steps = [];
        output.replaceChildren(button('Detener cálculo', () => { generation++; output.replaceChildren(); }));
        for (let current = iterator.next(); ; current = iterator.next()) {
          if (current.done) { result = { ...current.value, steps }; break; }
          steps.push(current.value);
          if (steps.length % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
          if (ticket !== generation || !output.isConnected) return;
        }
      }
      if (saved.mode === 'practice') output.replaceChildren(practice(parsed, result, topic, saved, save, calculate));
      else {
        const summary = el('div', { class: 'stack' }, resultSummary(parsed, result));
        output.replaceChildren(graphical ? graphPlayer(parsed, result) :
          tracePlayer(result.steps, simplexStep, 'Simplex paso a paso', { autoplay: true }), summary);
        if (!graphical && result.status === 'optimal') output.append(button('Comprobar redundancia y otros óptimos', () => {
          const diagnostics = diagnoseSimplex(parsed, result);
          summary.replaceChildren(resultSummary(parsed, { ...result, ...diagnostics }),
            el('p', {}, diagnostics.redundant.length ? 'Restricciones redundantes: ' + diagnostics.redundant.join(', ') :
              'Todas las restricciones son necesarias según la prueba de violación individual.'));
        }));
      }
      error.hidden = true;
    } catch (failure) {
      output.replaceChildren();
      error.hidden = false;
      error.textContent = failure.message;
    }
  }
  function load(id, variant = 0) {
    const exercise = lpExercises.find((candidate) => candidate.id === id);
    const next = exercise?.variants[variant]?.draft;
    if (next) saved.draft = structuredClone(next);
    saved.exercise = id;
    saved.variant = variant;
    saved.step = 0;
    saved.choices = [];
    save();
    render();
  }
  function transfer() {
    const nextTopic = graphical ? 'simplex' : 'graphic';
    const previous = state.linear[nextTopic];
    if (previous && JSON.stringify(previous.draft) !== JSON.stringify(draft) &&
        !window.confirm('¿Sustituir el modelo guardado en ' + lpTitles[nextTopic] + '?')) return;
    state.linear[nextTopic] = structuredClone({ ...saved, step: 0, choices: [] });
    save();
    go(lpRoutes[nextTopic]);
  }
  function compareMethods() {
    try {
      const parsed = parseLP(draft);
      const graph = solveGraphical(parsed);
      const simplex = solveSimplex(parsed);
      const equal = graph.status === simplex.status && (!graph.value || (simplex.value && compare(graph.value, simplex.value) === 0));
      output.replaceChildren(el('div', { class: 'panel stack' }, el('h2', {}, 'Comparación de métodos'),
        el('div', { class: 'step-grid' }, el('div', {}, el('h3', {}, lpTitles.graphic), resultSummary(parsed, graph)),
          el('div', {}, el('h3', {}, lpTitles.simplex), resultSummary(parsed, simplex))),
        el('p', { class: 'status' }, equal ? 'Coinciden los estados y valores objetivos.' : 'Hay una diferencia entre los métodos.'),
        plotLP(parsed, graph, { path: simplex.bases }),
        el('ol', {}, simplex.bases.map((current, index) => el('li', {},
          'Base ' + (index + 1) + ' · ' + point(current) +
          (index > 0 && current.every((value, j) => compare(value, simplex.bases[index - 1][j]) === 0)
            ? ' · El pivote conserva el punto.' : ''))))));
    } catch (failure) { error.hidden = false; error.textContent = failure.message; }
  }
  function showDual() {
    try {
      const parsed = parseLP(draft);
      const dual = dualLP(parsed);
      const primalResult = solveSimplex(parsed);
      const dualResult = solveSimplex(dual);
      output.replaceChildren(el('div', { class: 'panel stack' }, el('h2', {}, 'Primal y dual'),
        el('div', { class: 'step-grid' }, el('section', {}, el('h3', {}, 'Primal'), modelFormulas(parsed), resultSummary(parsed, primalResult)),
          el('section', {}, el('h3', {}, 'Dual'), modelFormulas(dual), resultSummary(dual, dualResult))),
        primalResult.value && dualResult.value && el('p', { class: 'status' }, certifyDualPair(parsed, dual, primalResult, dualResult)
          ? 'Dualidad fuerte · los objetivos coinciden y se verifica la holgura complementaria.'
          : 'No se pudo certificar la dualidad de las soluciones calculadas.')));
    } catch (failure) { error.hidden = false; error.textContent = failure.message; }
  }

  const options = [['custom', 'Modelo propio'], ...lpExercises.map(({ id, title }) => [id, title])];
  const editor = el('section', { class: 'panel stack' }, el('h2', {}, 'Modelo editable'),
    select('Ejercicio', options, saved.exercise || 'custom', (id) => load(id)),
    item?.variants.length > 1 && select('Variante', item.variants.map(({ label }, j) => [String(j), label]),
      String(saved.variant), (index) => load(item.id, Number(index))),
    input('Nombre', draft.name, (value) => { draft.name = value; changed(); }),
    select('Sentido', [['max','Maximizar'],['min','Minimizar']], draft.sense, (value) => { draft.sense = value; changed(); }),
    el('div', { class: 'answer-grid' }, draft.variables.map((variable, i) =>
      el('div', { class: 'stack' },
        input('Variable ' + (i + 1), variable.name, (value) => { variable.name = value; changed(); }),
        select('Dominio ' + (i + 1), [['positive','≥ 0'],['negative','≤ 0'],['free','Libre']], variable.domain,
          (value) => { variable.domain = value; changed(); }),
        input('Objetivo · coeficiente ' + (i + 1), draft.objective[i], (value) => { draft.objective[i] = value; changed(); })))),
    !graphical && button('Agregar variable', () => {
      if (draft.variables.length >= 32) return;
      draft.variables.push({ name: 'X' + (draft.variables.length + 1), domain: 'positive' });
      draft.objective.push('0');
      draft.constraints.forEach((row) => row.coefficients.push('0'));
      changed(); render();
    }, { disabled: draft.variables.length >= 32 }),
    !graphical && draft.variables.length > 1 && button('Quitar última variable', () => {
      draft.variables.pop(); draft.objective.pop(); draft.constraints.forEach((row) => row.coefficients.pop());
      changed(); render();
    }),
    el('h3', {}, 'Restricciones'),
    draft.constraints.map((row, i) => el('fieldset', { class: 'lp-row answer-grid' }, el('legend', {}, row.id),
      row.coefficients.map((value, j) => input(row.id + ' · coeficiente ' + (j + 1), value,
        (next) => { row.coefficients[j] = next; changed(); })),
      select(row.id + ' · operador', Object.entries(relation), row.operator, (value) => { row.operator = value; changed(); }),
      input(row.id + ' · término independiente', row.bound, (value) => { row.bound = value; changed(); }),
      button('Quitar ' + row.id, () => { draft.constraints.splice(i, 1); changed(); render(); }))),
    button('Agregar restricción', () => {
      if (draft.constraints.length >= 32) return;
      let i = 1;
      while (draft.constraints.some((row) => row.id === 'R' + i)) i++;
      draft.constraints.push({ id: 'R' + i, coefficients: draft.variables.map(() => '0'), operator: '<=', bound: '0' });
      changed(); render();
    }, { disabled: draft.constraints.length >= 32 }));
  updatePreview();
  if (requestedMode) queueMicrotask(calculate);
  return el('div', { class: 'stack' }, pageTitle(lpTitles[topic], draft.name),
    item && lpStatement(item),
    item?.note && saved.mode !== 'practice' && el('details', { class: 'panel' }, el('summary', {}, 'Notas de la fuente'),
      el('p', {}, item.note)),
    el('div', { class: 'workspace' }, editor,
      el('aside', { class: 'panel stack' }, el('h2', {}, 'Formulación'), error, preview)),
    el('details', { class: 'panel' }, el('summary', {}, 'Fórmulas y conceptos'),
      graphical ? el('ul', {},
        el('li', {}, 'Cortes de ax + by = c con los ejes. x = c/a cuando y = 0, e y = c/b cuando x = 0, con divisor distinto de cero.'),
        el('li', {}, 'Los semiplanos reúnen los puntos que cumplen cada desigualdad. Su intersección, incluidos los dominios, es la región factible.'),
        el('li', {}, 'La recta objetivo c₁x + c₂y = Z avanza en la dirección de mejora. Un rayo de recesión mantiene la factibilidad al prolongarse.')) :
        el('ul', {},
          el('li', {}, 'Para una ligadura ≤ suma una holgura. Para una ligadura ≥ resta un exceso y agrega una artificial. Una igualdad puede requerir una artificial.'),
          el('li', {}, 'La guía ilustra holguras con X = 2 e Y = 3. Así, 2X + 3Y + 7 = 20, X + 5Y + 13 = 30 y 4X + 2Y + 1 = 15. Fuente: Simplex, planteos. Máx-Mín-Dual.pdf, p. 1.'),
          el('li', {}, 'Zj = Σ Ck·akj. En Máx mejora Zj−Cj < 0 y en Mín mejora Zj−Cj > 0. Calcula θᵢ = Bᵢ/aᵢⱼ cuando aᵢⱼ > 0.'),
          el('li', {}, 'La fase I minimiza la suma de artificiales y muestra sus costos con M. La fase II optimiza el objetivo original.'),
          el('li', {}, 'En el dual, cada ligadura primal da una variable dual y cada variable primal da una ligadura dual. Los óptimos factibles tienen objetivos iguales y holgura complementaria.'))),
    el('div', { class: 'actions' }, button('Aprender', () => { saved.mode = 'learn'; updatePreview(); save(); calculate(); }, { class: 'primary' }),
      button(saved.step ? 'Reanudar práctica' : 'Practicar', () => { saved.mode = 'practice'; updatePreview(); save(); calculate(); }),
      draft.variables.length === 2 && button('Abrir en ' + lpTitles[graphical ? 'simplex' : 'graphic'], transfer),
      draft.variables.length === 2 && button('Comparar métodos', compareMethods),
      !graphical && button('Ver primal y dual', showDual),
      link('Ir al examen', 'examen', { class: 'button' })), output);
}
