import { add, compare, divide, multiply, subtract, formatRational } from './rational.js';
import { dot, neg, one, validPoint, zero } from './lp.js';

export function halfPlanes(model) {
  const rows = model.constraints.flatMap(({ coefficients, bound, operator, id }) => {
    const normal = { coefficients, bound, id };
    const reversed = { coefficients: coefficients.map(neg), bound: neg(bound), id };
    return operator === '=' ? [normal, reversed] : [operator === '<=' ? normal : reversed];
  });
  model.variables.forEach(({ domain }, j) => {
    if (domain === 'free') return;
    const coefficients = [zero, zero];
    coefficients[j] = domain === 'positive' ? neg(one) : one;
    rows.push({ id: 'dominio-' + j, coefficients, bound: zero });
  });
  return rows;
}

function boundsOf(inequalities) {
  let lower = null;
  let upper = null;
  let lowerRow;
  let upperRow;
  for (const inequality of inequalities) {
    const [a, b] = inequality;
    const sign = compare(a, zero);
    if (!sign) {
      if (compare(b, zero) < 0) return { contradiction: [inequality] };
    } else {
      const limit = divide(b, a);
      if (sign < 0 && (lower === null || compare(limit, lower) > 0)) {
        lower = limit;
        lowerRow = inequality;
      }
      if (sign > 0 && (upper === null || compare(limit, upper) < 0)) {
        upper = limit;
        upperRow = inequality;
      }
    }
  }
  return lower !== null && upper !== null && compare(lower, upper) > 0
    ? { contradiction: [lowerRow, upperRow] } : { range: { lower, upper } };
}

function project(rows) {
  const negative = [];
  const positive = [];
  const remaining = [];
  for (const row of rows) {
    const [a, b] = row.coefficients;
    const sign = compare(b, zero);
    if (!sign) remaining.push([a, row.bound, [{ plane: row, factor: one }]]);
    else (sign < 0 ? negative : positive).push(row);
  }
  for (const low of negative) for (const high of positive) {
    const left = neg(low.coefficients[1]);
    const right = high.coefficients[1];
    remaining.push([
      add(multiply(low.coefficients[0], right), multiply(high.coefficients[0], left)),
      add(multiply(low.bound, right), multiply(high.bound, left)),
      [{ plane: low, factor: right }, { plane: high, factor: left }]
    ]);
  }
  return { ...boundsOf(remaining), elimination: remaining };
}

function lift(rows, first) {
  const { range } = boundsOf(rows.map(({ coefficients: [a, b], bound }) => [b, subtract(bound, multiply(a, first))]));
  return { range, point: [first, range.lower ?? range.upper ?? zero] };
}

function optimize(rows, objective, sense) {
  const main = objective[0].numerator ? 0 : 1;
  if (!objective[main].numerator) {
    const { range, contradiction, elimination } = project(rows);
    const projectionData = { elimination, projectedRows: rows, projectedVariable: 'X' };
    return range ? { ...projectionData, status: 'optimal', value: zero, point: lift(rows, range.lower ?? range.upper ?? zero).point } :
      { ...projectionData, status: 'infeasible', contradiction };
  }
  const other = 1 - main;
  const transformed = rows.map(({ coefficients, bound, id }) => {
    const factor = divide(coefficients[main], objective[main]);
    return { id, coefficients: [factor, subtract(coefficients[other], multiply(factor, objective[other]))], bound };
  });
  const { range, contradiction, elimination } = project(transformed);
  const projectionData = { elimination, projectedRows: transformed, projectedVariable: 'Z' };
  if (!range) return { ...projectionData, status: 'infeasible', contradiction };
  const bound = sense === 'max' ? range.upper : range.lower;
  const value = bound ?? (range.lower ?? range.upper ?? zero);
  const section = lift(transformed, value);
  function original(z, transverse) {
    const point = [];
    point[other] = transverse;
    point[main] = divide(subtract(z, multiply(objective[other], transverse)), objective[main]);
    return point;
  }
  const point = original(...section.point);
  if (bound === null) return { ...projectionData, status: 'unbounded', point, projection: range };
  const { lower, upper } = section.range;
  const alternative = lower === null ? original(value, subtract(section.point[1], one)) :
    upper === null ? original(value, add(lower, one)) :
      compare(lower, upper) === 0 ? null : original(value, upper);
  return { ...projectionData, status: 'optimal', point, value, alternative, projection: range, optimalSection: section.range };
}

function intersections(rows) {
  const points = new Map();
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const { coefficients: [a, b], bound: c } = rows[i];
    const { coefficients: [d, e], bound: f } = rows[j];
    const determinant = subtract(multiply(a, e), multiply(b, d));
    if (!determinant.numerator) continue;
    const point = [
      divide(subtract(multiply(c, e), multiply(b, f)), determinant),
      divide(subtract(multiply(a, f), multiply(c, d)), determinant)
    ];
    if (rows.every(({ coefficients, bound }) => compare(dot(coefficients, point), bound) <= 0)) {
      points.set(point.map(formatRational).join(','), point);
    }
  }
  return [...points.values()];
}

export function solveGraphical(model) {
  if (model.variables.length !== 2) throw new Error('El Método Gráfico requiere dos variables.');
  const planes = halfPlanes(model);
  const result = optimize(planes, model.objective, model.sense);
  const steps = [
    { operation: 'normalize', before: model.constraints, operands: model.variables, after: planes },
    { operation: 'change-coordinates', before: planes, operands: model.objective, after: result.projectedRows },
    ...result.elimination.map(([a, b, sources]) => ({
      operation: 'eliminate-coordinate', before: sources.map(({ plane }) => plane),
      operands: sources.map(({ factor }) => factor), after: { coefficient: a, bound: b }
    })),
    { operation: 'intersect-bounds', before: result.elimination, operands: model.sense,
      after: result.projection ?? result.contradiction ?? { objective: zero } }
  ];
  if (result.status === 'infeasible') return { ...result, steps, planes, vertices: [], redundant: [] };
  const homogeneous = planes.map((row) => ({ ...row, bound: zero }));
  const axes = [[one, zero], [neg(one), zero], [zero, one], [zero, neg(one)]];
  const recession = axes.map((coefficients) => optimize(
    [...homogeneous, { coefficients: coefficients.map(neg), bound: neg(one) }], [zero, zero], 'min'
  )).filter(({ point }) => point).map(({ point }) => point);
  if (result.status === 'unbounded') {
    const coefficients = model.sense === 'max' ? model.objective.map(neg) : model.objective;
    result.ray = optimize([...homogeneous, { coefficients, bound: neg(one) }], [zero, zero], 'min').point;
    if (!result.ray || !validPoint(model, result.ray, true)) throw new Error('Rayo gráfico inválido.');
  }
  if (result.status === 'optimal' && !model.objective.some((value) => value.numerator)) {
    for (const axis of axes) {
      const extreme = optimize(planes, axis, 'max');
      if (extreme.status === 'unbounded') {
        const current = dot(axis, result.point);
        result.alternative = optimize([...planes, {
          coefficients: axis.map(neg), bound: neg(add(current, one))
        }], [zero, zero], 'min').point;
      } else if (compare(extreme.value, dot(axis, result.point)) > 0) result.alternative = extreme.point;
      if (result.alternative) break;
    }
  }
  const redundant = model.constraints.filter(({ id, coefficients, bound, operator }) => {
    const remaining = planes.filter((row) => row.id !== id);
    const holds = (vector, limit) => {
      const outcome = optimize(remaining, vector, 'max');
      return outcome.status === 'optimal' && compare(outcome.value, limit) <= 0;
    };
    return (operator === '>=' || holds(coefficients, bound)) &&
      (operator === '<=' || holds(coefficients.map(neg), neg(bound)));
  }).map(({ id }) => id);
  const vertices = intersections(planes);
  steps.push({ operation: 'enumerate-vertices', before: planes, operands: model.objective,
    after: vertices.map((point) => ({ point, value: dot(model.objective, point) })) },
  { operation: 'certify-result', before: model, operands: { point: result.point, ray: result.ray },
    after: { status: result.status, value: result.value, alternative: result.alternative } });
  const degenerateVertices = vertices.filter((point) => new Set(planes.filter(({ coefficients, bound }) =>
    coefficients.some((value) => value.numerator) && compare(dot(coefficients, point), bound) === 0).map(({ id }) => id)).size > 2);
  return { ...result, steps, planes, recession, vertices, degenerateVertices, redundant };
}
