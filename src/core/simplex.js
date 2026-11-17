import { add, compare, divide, multiply, subtract } from './rational.js';
import { dot, flip, neg, one, validPoint, zero } from './lp.js';

function standardize(model) {
  const columns = model.variables.flatMap(({ name, domain }, index) => {
    if (domain === 'free') return [{ name: name + '+', index, sign: one }, { name: name + '−', index, sign: neg(one) }];
    return [{ name, index, sign: domain === 'negative' ? neg(one) : one }];
  });
  const rows = model.constraints.map(({ id, coefficients, bound, operator }, index) => {
    const reverse = compare(bound, zero) < 0;
    return {
      id, originalOperator: operator, operator: reverse ? flip(operator) : operator, reverse,
      multipliers: model.constraints.map((_, j) => j === index ? reverse ? neg(one) : one : zero),
      bound: reverse ? neg(bound) : bound,
      values: columns.map(({ index, sign }) => multiply(coefficients[index], reverse ? neg(sign) : sign))
    };
  });
  const basis = [];
  function append(index, name, value, artificial = false) {
    const column = columns.length;
    columns.push({ name, artificial });
    rows.forEach((row, i) => row.values.push(i === index ? value : zero));
    return column;
  }
  rows.forEach((row, i) => {
    if (row.operator === '<=') basis.push(append(i, 'H' + (i + 1), one));
    else {
      if (row.operator === '>=') append(i, 'E' + (i + 1), neg(one));
      basis.push(append(i, 'A' + (i + 1), one, true));
    }
  });
  return {
    rows, columns, basis,
    costs: columns.map(({ index, sign }) => index === undefined ? zero : multiply(model.objective[index], sign))
  };
}

export function* simplexSteps(model, choices = []) {
  let { rows, columns, basis, costs } = standardize(model);
  yield { kind: 'standard', rows, columns, basis };
  let phase = columns.some((column) => column.artificial) ? 1 : 2;
  let bland = false;
  const bases = [];
  const removed = [];
  let iteration = 0;
  const sense = model.sense === 'max' ? 1 : -1;
  const recover = (values) => {
    const original = model.variables.map(() => zero);
    columns.forEach(({ index, sign }, i) => {
      if (index !== undefined) original[index] = add(original[index], multiply(sign, values[i]));
    });
    return original;
  };
  function basicPoint() {
    const values = columns.map(() => zero);
    basis.forEach((j, i) => { values[j] = rows[i].bound; });
    return recover(values);
  }
  function pivot(leaving, entering) {
    const before = rows;
    const pivotValue = before[leaving].values[entering];
    const normalized = {
      ...before[leaving], bound: divide(before[leaving].bound, pivotValue),
      multipliers: before[leaving].multipliers.map((value) => divide(value, pivotValue)),
      values: before[leaving].values.map((value) => divide(value, pivotValue))
    };
    rows = before.map((row, i) => {
      if (i === leaving) return normalized;
      const factor = row.values[entering];
      return { ...row, bound: subtract(row.bound, multiply(factor, normalized.bound)),
        multipliers: row.multipliers.map((value, j) => subtract(value, multiply(factor, normalized.multipliers[j]))),
        values: row.values.map((value, j) => subtract(value, multiply(factor, normalized.values[j]))) };
    });
    basis = basis.map((j, i) => i === leaving ? entering : j);
    return { rows, basis, pivotValue, normalized };
  }
  while (true) {
    const penalties = columns.map(({ artificial }) => artificial && phase === 1 ? (sense === 1 ? neg(one) : one) : zero);
    const reduce = (objective) => columns.map((_, j) =>
      dot(basis.map((basic) => objective[basic]), rows.map(({ values }) => values[j])));
    const zj = reduce(costs);
    const mj = reduce(penalties);
    const reduced = zj.map((value, j) => subtract(value, costs[j]));
    const mr = mj.map((value, j) => subtract(value, penalties[j]));
    const rates = phase === 1 ? mr : reduced;
    bland ||= rows.some(({ bound }) => !bound.numerator);
    const candidates = columns.flatMap((column, j) =>
      (phase === 2 || !column.artificial) && !basis.includes(j) && compare(rates[j], zero) === -sense ? [j] : []);
    const firstEntering = candidates.reduce((best, j) => best === undefined ||
      (!bland && compare(rates[j], rates[best]) === -sense) ? j : best, undefined);
    const enteringOptions = firstEntering === undefined ? [] : bland ? [firstEntering] :
      candidates.filter((j) => compare(rates[j], rates[firstEntering]) === 0);
    const requested = choices[iteration];
    const entering = enteringOptions.includes(requested?.entering) ? requested.entering : firstEntering;
    const point = basicPoint();
    const value = dot(model.objective, point);
    if (phase === 2) {
      if (!validPoint(model, point)) throw new Error('La base no cumple el modelo original.');
      bases.push(point);
    }
    const table = { phase, rows, columns, basis, costs, penalties, zj, mj, reduced, mr, value, entering, enteringOptions, iteration, bland };
    if (entering === undefined) {
      yield { ...table, kind: 'table' };
      if (phase === 2) return { status: 'optimal', point, value, bases, removed };
      const residual = basis.reduce((total, j, i) => columns[j].artificial ? add(total, rows[i].bound) : total, zero);
      if (residual.numerator) {
        const multipliers = model.constraints.map((_, index) =>
          basis.reduce((total, j, i) => columns[j].artificial ? add(total, rows[i].multipliers[index]) : total, zero));
        const coefficients = model.variables.map((_, j) => dot(multipliers, model.constraints.map((row) => row.coefficients[j])));
        const bound = dot(multipliers, model.constraints.map((row) => row.bound));
        const validSigns = model.constraints.every(({ operator }, i) => operator === '=' ||
          compare(multipliers[i], zero) !== (operator === '<=' ? 1 : -1));
        const validDomains = model.variables.every(({ domain }, j) => domain === 'free'
          ? !coefficients[j].numerator : compare(coefficients[j], zero) !== (domain === 'positive' ? 1 : -1));
        if (!validSigns || !validDomains || compare(bound, zero) <= 0) throw new Error('Certificado auxiliar inválido.');
        return { status: 'infeasible', residual, certificate: { multipliers, coefficients, bound }, bases, removed };
      }
      while (true) {
        const leaving = basis.findIndex((j) => columns[j].artificial);
        if (leaving < 0) break;
        const replacement = columns.findIndex((column, j) =>
          !column.artificial && !basis.includes(j) && rows[leaving].values[j].numerator);
        if (replacement >= 0) {
          const before = rows;
          yield { kind: 'cleanup', entering: replacement, leaving, columns, before, ...pivot(leaving, replacement) };
        } else {
          const id = rows[leaving].id;
          removed.push(id);
          rows = rows.filter((_, i) => i !== leaving);
          basis = basis.filter((_, i) => i !== leaving);
          yield { kind: 'remove', id };
        }
      }
      const kept = columns.flatMap((column, j) => column.artificial ? [] : [j]);
      basis = basis.map((j) => kept.indexOf(j));
      rows = rows.map((row) => ({ ...row, values: kept.map((j) => row.values[j]) }));
      columns = kept.map((j) => columns[j]);
      costs = kept.map((j) => costs[j]);
      phase = 2;
      continue;
    }
    const ratios = rows.map(({ values, bound }) => compare(values[entering], zero) > 0 ? divide(bound, values[entering]) : null);
    const firstLeaving = ratios.reduce((best, ratio, i) => ratio !== null && (best < 0 ||
      compare(ratio, ratios[best]) < 0 || (compare(ratio, ratios[best]) === 0 && basis[i] < basis[best])) ? i : best, -1);
    const leavingOptions = firstLeaving < 0 ? [] : bland ? [firstLeaving] :
      ratios.flatMap((ratio, i) => ratio !== null && compare(ratio, ratios[firstLeaving]) === 0 ? [i] : []);
    const leaving = leavingOptions.includes(requested?.leaving) ? requested.leaving : firstLeaving;
    yield { ...table, kind: 'table', ratios, leaving, leavingOptions };
    if (leaving < 0) {
      const direction = columns.map(() => zero);
      direction[entering] = one;
      basis.forEach((j, i) => { direction[j] = neg(rows[i].values[entering]); });
      const ray = recover(direction);
      if (phase !== 2 || !validPoint(model, ray, true) || compare(dot(model.objective, ray), zero) !== sense) {
        throw new Error('No se pudo certificar la no acotación.');
      }
      return { status: 'unbounded', point, ray, bases, removed };
    }
    yield { ...table, kind: 'pivot', ratios, leaving, leavingOptions, before: rows, previousBasis: basis, ...pivot(leaving, entering) };
    iteration++;
  }
}

export function solveSimplex(model, choices) {
  const iterator = simplexSteps(model, choices);
  const steps = [];
  for (let next = iterator.next(); ; next = iterator.next()) {
    if (next.done) return { ...next.value, steps };
    steps.push(next.value);
  }
}
