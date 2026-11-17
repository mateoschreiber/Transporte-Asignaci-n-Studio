import { checkAssignment, realPairs } from '../core/assignment-model.js';
import { coverZeros, hungarianAdjustment, maximumMatching, reduction, validCover, solveHungarian } from '../core/hungarian.js';
import { el } from './dom.js';
import { assignmentShape, assignmentStep, assignmentTable } from './assignment.js';
import { cellSelection, choiceField, numericFields } from './practice.js';

export function assignmentPractice(model) {
  let stage = 'balance';
  let matrix = model.working;
  let column = false;
  let line = 0;
  let cover;
  let resulting;
  let pairs;
  const scale = model.costScale;
  const n = model.size;
  const feasible = maximumMatching(model.original, (value) => value !== null);
  const setStage = (next) => () => { stage = next; };
  const basicTable = () => assignmentTable(model, matrix);
  function task(title, prompt, assessment, hints, proceed, scene = basicTable()) {
    return { title, prompt, ...assessment, hints, proceed, scene: assessment.scene ?? scene };
  }
  function balance() {
    const shape = { ...model, rows: model.rows.slice(0, model.m), columns: model.columns.slice(0, model.n) };
    return task('Determinar el orden de la matriz', 'Indica el tamaño de la matriz cuadrada que necesita el método.',
      numericFields([{ label: 'Número de filas después de balancear', scale: 1, answer: n }]),
      ['Cada fila necesita una columna para formar pareja.', 'Completa el lado menor hasta igualarlo con el mayor.'],
      setStage('feasibility'), assignmentTable(shape, model.original, { zeros: false }));
  }
  function feasibility() {
    const select = choiceField('Estado del modelo', [['yes', 'Existe una asignación completa'], ['no', 'Es infactible']],
      (value) => value === (feasible.size === n ? 'yes' : 'no'));
    return task('Verificar parejas permitidas', 'Determina si es posible elegir una pareja permitida por fila y por columna.',
      select, ['Cada fila y columna admite una sola pareja.', 'Busca si varias filas compiten por menos columnas de las que necesitan.'],
      setStage(feasible.size < n ? 'infeasible' : model.objective === 'max' ? 'max' : 'reduce'),
      el('div', { class: 'stack' }, el('p', { class: 'dim' }, assignmentShape(model)), assignmentTable(model, model.original, { zeros: false })));
  }
  function transform() {
    let example;
    model.original.some((row, i) => row.some((value, j) => {
      if (value === null) return false;
      example = { i, j };
      return true;
    }));
    return task('Transformar la maximización', 'Encuentra el beneficio máximo y el costo equivalente de la celda destacada.',
      numericFields([{ label: 'Beneficio máximo', answer: model.maximum, scale },
        { label: 'Costo equivalente', answer: matrix[example.i][example.j], scale }]),
      ['Usa la matriz balanceada y considera solo celdas permitidas.', 'Calcula Bmáx − Bᵢⱼ para la celda indicada.'],
      setStage('reduce'), assignmentTable(model, model.original, { zeros: false, matching: { [example.i]: example.j } }));
  }
  function reduce() {
    const operation = reduction(matrix, column ? 'column' : 'row', line);
    const name = column ? model.columns[line] : model.rows[line];
    return task('Reducir ' + (column ? 'columna' : 'fila') + ' · ' + name,
      'Indica el valor que se debe restar de todos los elementos permitidos de esta línea.',
      numericFields([{ label: 'Mínimo', scale, answer: operation.minimum }]),
      ['Lee solo la línea resaltada.', 'Descarta las celdas × y busca el valor más pequeño, incluidos los ceros.'],
      () => {
        matrix = operation.after;
        line++;
        if (line < n) return;
        line = 0;
        if (column) stage = 'cover';
        column = true;
      }, assignmentTable(model, matrix, { located: { ...operation, phase: 'after' } }));
  }
  function selectCover() {
    const minimum = coverZeros(matrix).matching.size;
    const rows = Array(n).fill(false);
    const columns = Array(n).fill(false);
    const display = el('div');
    function draw() {
      display.replaceChildren(assignmentTable(model, matrix, { rows, columns }));
    }
    const selectors = el('div', { class: 'cover-selectors' },
      [[model.rows, rows, 'Fila'], [model.columns, columns, 'Columna']].map(([labels, flags, prefix]) =>
        el('fieldset', {}, el('legend', {}, prefix === 'Fila' ? 'Filas' : 'Columnas'),
          labels.map((name, i) => el('label', { class: 'field' },
            el('input', { type: 'checkbox', onChange: (event) => { flags[i] = event.target.checked; draw(); } }), prefix + ' ' + name)))));
    draw();
    const validate = () => {
      if (!matrix.every((row, i) => row.every((value, j) => value !== 0 || rows[i] || columns[j]))) {
        return 'Todavía quedan ceros sin cubrir.';
      }
      if (!validCover(matrix, rows, columns, minimum)) return 'La cobertura puede hacerse con menos líneas.';
      return null;
    };
    return task('Cubrir los ceros con líneas mínimas',
      'Marca una combinación de filas y columnas que cubra cada cero con el menor número de líneas.',
      { fields: selectors, validate: validate }, ['Comprueba que cada cero quede bajo al menos una línea.', 'El número de ceros independientes da el número mínimo de líneas.'],
      () => { cover = { rows: [...rows], columns: [...columns], minimum }; stage = 'criterion'; },
      display);
  }
  function criterion() {
    const select = choiceField('Siguiente operación', [['pairs', 'Seleccionar parejas óptimas'], ['adjust', 'Ajustar los valores sin cubrir']],
      (value) => value === (cover.minimum === n ? 'pairs' : 'adjust'));
    return task('Aplicar el criterio de optimalidad', 'Hay ' + cover.minimum + ' líneas en una matriz de orden ' + n + '. Decide el siguiente paso.',
      select, ['Compara el número de líneas con el orden.', 'Con n líneas mínimas hay n ceros independientes.'],
      setStage(cover.minimum === n ? 'pairs' : 'adjust'), assignmentTable(model, matrix, cover));
  }
  function adjust() {
    const operation = hungarianAdjustment(matrix, cover.rows, cover.columns);
    return task('Identificar el menor valor sin cubrir', 'Calcula δ para hacer el ajuste de la matriz.',
      numericFields([{ label: 'δ', scale, answer: operation.minimum }]),
      ['Considera solo celdas que estén fuera de ambas coberturas.', 'Resta δ en las celdas descubiertas. Suma δ donde se cruzan dos líneas.'],
      () => { matrix = operation.after; stage = 'cover'; }, assignmentTable(model, matrix, cover));
  }
  function choosePairs() {
    const pick = cellSelection((choose) => assignmentTable(model, matrix, { choose }), { multiple: true });
    function validate() {
      const selected = pick.selections;
      if (selected.some(({ i, j }) => matrix[i][j] !== 0)) return 'Cada pareja elegida debe ser un cero permitido.';
      if (new Set(selected.map(({ i }) => i)).size !== selected.length) return 'Hay una fila con más de una pareja.';
      if (new Set(selected.map(({ j }) => j)).size !== selected.length) return 'Hay una columna con más de una pareja.';
      return selected.length === n ? null : 'Selecciona exactamente ' + n + ' ceros independientes.';
    }
    return task('Seleccionar ceros independientes', 'Elige una pareja permitida para cada fila y columna del modelo cuadrado.',
      { ...pick, validate }, ['Cada fila debe quedar con una sola celda seleccionada.', 'Si dos ceros comparten columna, busca un cero alternativo en alguna fila.'],
      () => {
        resulting = Array(n).fill(-1);
        pick.selections.forEach(({ i, j }) => { resulting[i] = j; });
        pairs = realPairs(model, resulting);
        stage = 'total';
      });
  }
  function total() {
    const check = checkAssignment(model, pairs);
    if (!check.ok) throw new Error(check.issues.join(' '));
    return task('Evaluar la asignación original', 'Suma el costo o beneficio original de las parejas seleccionadas.',
      numericFields([{ label: 'Z de la asignación', scale, answer: check.z }]),
      ['Usa los datos originales de la tabla.', 'La pareja ficticia tiene valor cero y no representa una asignación real.'],
      setStage('optimal'), assignmentTable(model, model.original, { matching: resulting }));
  }
  function finish() {
    const automatic = solveHungarian(model);
    if (automatic.z !== checkAssignment(model, pairs).z) throw new Error('El valor elegido no coincide con el certificado.');
    const originalSignature = JSON.stringify(automatic.pairs);
    const alternative = JSON.stringify(pairs) === originalSignature ? automatic.alternative : automatic.pairs;
    return { complete: assignmentStep(model, {
      kind: 'assignment-optimal', after: matrix, matching: resulting, pairs, z: automatic.z, alternative
    }) };
  }
  const views = {
    balance, feasibility, max: transform, reduce, cover: selectCover, criterion, adjust, pairs: choosePairs, total, optimal: finish,
    infeasible: () => ({ complete: assignmentStep(model, { kind: 'assignment-infeasible', after: model.original, matching: feasible }) })
  };
  return { next: () => views[stage]() };
}
