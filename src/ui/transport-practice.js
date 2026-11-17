import { applyInitialDecision, finishInitial, initialDecision, initialState, sameCell } from '../core/transport-initial.js';
import { applyModi, certifyModi, modiCycle, modiDecision } from '../core/modi.js';
import { validateBasis } from '../core/transport-basis.js';
import { methodNames } from '../data/exercises.js';
import { el } from './dom.js';
import { cellSelection, choiceField, numericFields } from './practice.js';
import { transportDecisionTable, transportStep, transportTable } from './transport.js';

export function transportPractice(model, method, optimize) {
  let stage = 'balance';
  let state = initialState(model);
  let decision;
  let chosenLine;
  let chosen;
  let move;
  let pendingPivot;
  let zeros = [];
  let bland = false;
  const costScale = model.costScale;
  const quantityScale = model.quantityScale;
  const label = ({ i, j }) => model.rows[i] + ' → ' + model.columns[j];
  const go = (next) => () => { stage = next; };
  const activeModel = model.fictitious && !model.fictitious.embedded ? {
    ...model,
    rows: model.fictitious.axis === 'row' ? model.rows.slice(0, -1) : model.rows,
    columns: model.fictitious.axis === 'column' ? model.columns.slice(0, -1) : model.columns,
    supply: model.fictitious.axis === 'row' ? model.supply.slice(0, -1) : model.supply,
    demand: model.fictitious.axis === 'column' ? model.demand.slice(0, -1) : model.demand
  } : model;
  function task(title, prompt, assessment, hints, proceed, scene = transportTable(model, state)) {
    return { title, prompt, ...assessment, hints, proceed, scene: assessment.scene ?? scene };
  }
  function chooseCell(options, render) {
    const picking = cellSelection(render);
    return {
      ...picking,
      validate: () => picking.selections.some((cell) => options.some((option) => sameCell(cell, option))) ? null :
        'Esa celda no cumple el criterio de esta operación.'
    };
  }
  function newInitial() {
    decision = initialDecision(model, state, method);
    if (decision.status === 'ready') stage = method === 'vogel' ? 'vogel-penalties' : method === 'russell' ? 'russell-maxima' : 'initial-cell';
    else stage = decision.status === 'done' ? 'zero-basis' : 'infeasible';
  }
  function newModi() {
    decision = modiDecision(model, state, bland);
    stage = 'potentials';
  }
  function balance() {
    const diff = numericFields([{ label: 'Oferta menos demanda', answer: model.difference, scale: quantityScale }]);
    const axis = choiceField('Ajuste necesario', [['none', 'Ninguno'], ['row', 'Agregar origen ficticio'], ['column', 'Agregar destino ficticio']],
      (value) => value === (model.difference < 0 ? 'row' : model.difference > 0 ? 'column' : 'none'));
    return task('Comprobar los márgenes', 'Calcula la diferencia y decide si debes agregar un ficticio.',
      { fields: el('div', { class: 'answer-grid' }, diff.fields, axis.fields), validate: () => diff.validate() || axis.validate() },
      ['Resta la demanda total a la oferta total.', 'Un déficit exige una fila. Un excedente exige una columna.'],
      newInitial, transportTable(activeModel));
  }
  function penalties() {
    const lineName = (line) => (line.axis === 'row' ? 'Fila ' + model.rows[line.index] : 'Columna ' + model.columns[line.index]);
    const ordinary = decision.lines.filter((line) => !line.forced);
    if (!ordinary.length) {
      stage = 'vogel-line';
      return lineChoice();
    }
    return task('Calcular penalizaciones de Vogel',
      'Completa la diferencia entre los dos menores costos elegibles de cada línea con dos o más rutas.',
      numericFields(ordinary.map((line) => ({ label: lineName(line), answer: line.penalty, scale: costScale }))),
      ['Usa solo las celdas con oferta y demanda pendientes.', 'Ordena los costos elegibles de menor a mayor. Resta el primero del segundo.'],
      go('vogel-line'), transportDecisionTable(model, state, decision, undefined, false));
  }
  function lineChoice() {
    const select = choiceField('Fila o columna', decision.lines.map((line, i) =>
      [String(i), (line.axis === 'row' ? 'Fila ' + model.rows[line.index] : 'Columna ' + model.columns[line.index])]),
    (value) => value !== '' && decision.lines[Number(value)]?.eligible);
    return task('Elegir la línea de Vogel', 'Selecciona una línea que tenga prioridad.',
      select, ['Las líneas con una sola ruta viable tienen prioridad.', 'Si no hay una ruta forzosa, compara las penalizaciones máximas. Los empates son válidos.'],
      () => { chosenLine = decision.lines[Number(select.value())]; stage = 'initial-cell'; },
      transportDecisionTable(model, state, decision));
  }
  function maxima() {
    return task('Calcular máximos de Russell', 'Encuentra el mayor costo elegible de cada línea activa.', numericFields([
      ...decision.maxima.rows.flatMap((answer, i) => answer === null ? [] : [{ label: 'Fila ' + model.rows[i], scale: costScale, answer }]),
      ...decision.maxima.columns.flatMap((answer, j) => answer === null ? [] : [{ label: 'Columna ' + model.columns[j], scale: costScale, answer }])
    ]), ['Ignora las rutas prohibidas y las líneas ya satisfechas.', 'Estos máximos se restarán al costo de cada ruta elegible.'], go('initial-cell'));
  }
  function initialCell() {
    const options = method === 'vogel' ? chosenLine.choices : decision.choices;
    const pick = chooseCell(options, (choose) => transportDecisionTable(model, state, decision, choose, method === 'vogel'));
    const guides = {
      northwest: ['Empieza en la esquina superior izquierda de la tabla activa.', 'Salta filas y columnas que ya estén satisfechas.'],
      minimum: ['Compara todos los costos unitarios elegibles.', 'Elige el menor costo entre rutas con ambos márgenes pendientes.'],
      vogel: ['Considera solo la línea que acabas de elegir.', 'Dentro de esa línea, busca el menor costo elegible.'],
      russell: ['Usa los máximos que acabas de calcular.', 'Elige el menor Cᵢⱼ − máximo de fila − máximo de columna.']
    };
    const line = method === 'vogel' ? (chosenLine.axis === 'row' ? 'Fila ' + model.rows[chosenLine.index] :
      'Columna ' + model.columns[chosenLine.index]) + '. ' : '';
    return task('Seleccionar la ruta · ' + methodNames[method], line + 'Marca una celda que cumpla el criterio.',
      pick, guides[method], () => { chosen = decision.choices.find((cell) => sameCell(cell, pick.selections[0])); stage = 'quantity'; });
  }
  function quantity() {
    return task('Asignar cantidad · ' + label(chosen), 'Calcula el envío que debe añadirse a esta celda.',
      numericFields([{ label: 'Unidades a asignar', answer: chosen.quantity, scale: quantityScale }]),
      ['Compara la oferta y la demanda pendientes de la celda.',
        chosen.quantity < chosen.bound ? 'Reserva las unidades que otros destinos necesitan a través de rutas limitadas.' :
          'La asignación es el menor de los dos márgenes pendientes.'],
      () => { state = applyInitialDecision(state, decision, chosen).state; newInitial(); },
      transportTable(model, state, { selection: chosen }));
  }
  function zeroBasis() {
    const standard = finishInitial(model, state);
    if (!standard.added.length) {
      state = standard.after;
      stage = 'basis';
      return basis();
    }
    const pick = cellSelection((choose) => transportTable(model, state, { choose }), { multiple: true });
    function matrixWithChoices() {
      const basis = state.allocation.map((row) => row.map((value) => value > 0));
      for (const { i, j } of pick.selections) basis[i][j] = true;
      return basis;
    }
    return task('Completar la base degenerada', 'El reparto ya conserva los márgenes. Elige ' +
      standard.added.length + ' celda(s) permitida(s) con flujo 0 para completar la base.',
    { ...pick, validate: () => pick.selections.length === standard.added.length &&
      pick.selections.every(({ i, j }) => state.allocation[i][j] === 0) &&
      validateBasis(model.costs, state.allocation, matrixWithChoices()) ? null :
      'Usa celdas con flujo cero que conecten la base sin formar ciclos.' },
    ['Una V.B. puede tener valor cero.', 'Añade una celda que conecte partes distintas de la base.'],
    () => {
      zeros = [...pick.selections];
      state = { ...state, basis: matrixWithChoices() };
      stage = 'basis';
    });
  }
  function basis() {
    return task('Calcular el costo de la SBF', 'Suma los productos entre cantidades asignadas y costos unitarios.',
      numericFields([{ label: 'Z de la SBF', answer: state.z, scale: model.objectiveScale }]),
      ['Usa únicamente cantidades de la matriz obtenida.', 'Calcula Σ Cᵢⱼ Xᵢⱼ. Un cero básico no contribuye al costo.'],
      () => { if (optimize) newModi(); else stage = 'initial-complete'; },
      transportTable(model, state, { showRole: true }));
  }
  function potentials() {
    const { anchors, potentials: values } = decision;
    const inputs = [
      ...values.rows.flatMap((answer, i) => anchors.includes(i) ? [] : [{ label: 'U' + (i + 1) + ' · ' + model.rows[i], answer, scale: costScale }]),
      ...values.columns.flatMap((answer, j) => anchors.includes(model.m + j) ? [] : [{ label: 'V' + (j + 1) + ' · ' + model.columns[j], answer, scale: costScale }])
    ];
    const anchorsText = anchors.map((anchor) => anchor < model.m ? 'U' + (anchor + 1) : 'V' + (anchor - model.m + 1));
    if (!inputs.length) { stage = 'reduced'; return reduced(); }
    return task('Encontrar potenciales MODI', 'Fija ' + anchorsText.join(', ') + ' en 0 y calcula el resto a partir de las V.B.',
      numericFields(inputs), ['Usa las celdas marcadas como V.B., incluso si x = 0.', 'Despeja un potencial en Uᵢ + Vⱼ = Cᵢⱼ cada vez que conozcas el otro.'],
      go('reduced'), transportTable(model, state, { showRole: true }));
  }
  function reduced() {
    const nonbasic = decision.reduced.flatMap((row, i) => row.flatMap((value, j) =>
      value !== null && !state.basis[i][j] ? [{ i, j, value }] : []));
    const chosenSamples = nonbasic.slice(0, 4);
    if (decision.choices.length && !chosenSamples.some((cell) => sameCell(cell, decision.choices[0]))) {
      chosenSamples.push({ ...decision.choices[0], value: decision.choices[0].cost });
    }
    if (!chosenSamples.length) { stage = 'enter'; return enter(); }
    return task('Calcular costos reducidos', 'Calcula el costo reducido de las V.N.B. indicadas.',
      numericFields(chosenSamples.map((item) => ({ label: 'r · ' + label(item), answer: item.value, scale: costScale }))),
      ['Usa los potenciales junto a los encabezados.', 'Por cada celda, calcula Cᵢⱼ − Uᵢ − Vⱼ.'],
      go('enter'), transportTable(model, state, { showRole: true, ...potentialLabels() }));
  }
  function potentialLabels() {
    return {
      rowHeaders: decision.potentials.rows.map((value) => 'U ' + value / costScale),
      columnHeaders: decision.potentials.columns.map((value) => 'V ' + value / costScale)
    };
  }
  function enter() {
    const noChoice = !decision.choices.length;
    const options = { showRole: true, reduced: decision.reduced, ...potentialLabels() };
    if (noChoice) {
      return task('Decidir si hay optimalidad', 'Examina los costos reducidos de las V.N.B. permitidas.',
        choiceField('Estado de la SBF', [['optimal', 'Es óptima'], ['pivot', 'Requiere otro pivote']], (value) => value === 'optimal'),
        ['Busca algún costo reducido negativo.', 'Si todos son ≥ 0, la SBF es óptima.'], go('optimal'), transportTable(model, state, options));
    }
    const pick = chooseCell(decision.choices, (choose) => transportTable(model, state, { ...options, choose }));
    return task('Elegir la variable entrante', bland ? 'Como hubo degeneración, aplica Bland por orden de fila y columna.' :
      'Selecciona una V.N.B. de costo reducido mínimo negativo.', pick,
      ['Solo puede entrar una V.N.B. de costo reducido negativo.', bland ? 'Toma la primera por posición.' : 'Entre los negativos, toma el más pequeño.'],
      () => { move = modiCycle(model, state, decision, pick.selections[0]); stage = 'cycle'; });
  }
  function cycle() {
    const pick = cellSelection((choose) => transportTable(model, state, { choose, showRole: true, selection: move.choice }),
      { multiple: true, ordered: true, initial: [move.choice] });
    function valid() {
      const ordered = move.cycle;
      const backward = [ordered[0], ...ordered.slice(1).reverse()];
      return pick.selections.length === ordered.length &&
        [ordered, backward].some((sequence) => sequence.every((cell, i) => sameCell(cell, pick.selections[i])));
    }
    return task('Construir el ciclo MODI', 'Empieza por la entrante marcada. Selecciona las V.B. en el orden del recorrido.',
      { ...pick, validate: () => valid() ? null : 'El ciclo debe cerrar con movimientos horizontales y verticales alternados.' },
      ['Usa solamente V.B. para los giros después de salir de la entrante.', 'Cada fila y columna recorrida conecta dos celdas del ciclo.'],
      go('theta'));
  }
  function theta() {
    return task('Calcular θ', 'Las celdas alternan signos desde + en la variable entrante. Determina el ajuste máximo.',
      numericFields([{ label: 'θ', answer: move.theta, scale: quantityScale }]),
      ['Solo las celdas con signo − pierden unidades.', 'Toma el menor valor asignado entre las donadoras, incluso si es cero.'],
      go('leave'), transportTable(model, state, { cycle: move.cycle, showRole: true }));
  }
  function leave() {
    const pick = chooseCell(move.leaving, (choose) => transportTable(model, state, { cycle: move.cycle, showRole: true, choose }));
    return task('Elegir la variable saliente', bland ? 'Selecciona la primera donadora mínima por orden de fila y columna.' :
      'Selecciona una donadora que quedará en cero después del ajuste.',
      pick, ['Lee los valores de las celdas con signo −.', 'La V.B. saliente cede toda su cantidad al aplicar θ.'],
      () => {
        pendingPivot = applyModi(model, state, decision, move, pick.selections[0]);
        stage = 'update';
      });
  }
  function updatePivot() {
    const { after, delta } = pendingPivot.step;
    return task('Actualizar cantidades y costo', 'Aplica θ según los signos del ciclo y calcula el cambio de costo.',
      numericFields([
        ...move.cycle.slice(0, 4).map((cell) => ({
          label: 'Cantidad nueva · ' + label(cell), answer: after.allocation[cell.i][cell.j], scale: quantityScale
        })),
        { label: 'ΔZ', answer: delta, scale: model.objectiveScale }
      ]), ['Suma θ en las receptoras y réstalo en las donadoras.', 'El cambio del objetivo es θ por el costo reducido de la entrante.'],
      () => {
        state = pendingPivot.state;
        bland ||= move.theta === 0;
        newModi();
      }, transportTable(model, state, { cycle: move.cycle, reduced: decision.reduced, showRole: true }));
  }
  const stages = {
    balance, 'vogel-penalties': penalties, 'vogel-line': lineChoice, 'russell-maxima': maxima, 'initial-cell': initialCell,
    quantity, 'zero-basis': zeroBasis, basis, potentials, reduced, enter, cycle, theta, leave, update: updatePivot,
    infeasible: () => ({ complete: transportStep(model, { kind: 'transport-infeasible', before: state, decision }) }),
    optimal: () => ({ complete: transportStep(model, certifyModi(model, state, decision)) }),
    'initial-complete': () => ({ complete: transportStep(model, { kind: 'basis', after: state, added: zeros }) })
  };
  return { next: () => stages[stage]() };
}
