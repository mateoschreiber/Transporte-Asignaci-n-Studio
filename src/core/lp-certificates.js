import { compare, multiply, subtract } from './rational.js';
import { dot, neg, one, validPoint, zero } from './lp.js';
import { solveSimplex } from './simplex.js';

export function diagnoseSimplex(model, solution) {
  if (solution.status !== 'optimal') return {};
  const redundant = [];
  for (const [i, row] of model.constraints.entries()) {
    const constraints = model.constraints.filter((_, index) => i !== index);
    const holds = (objective, bound) => {
      const result = solveSimplex({ ...model, constraints, objective, sense: 'max' });
      return result.status === 'optimal' && compare(result.value, bound) <= 0;
    };
    if ((row.operator === '>=' || holds(row.coefficients, row.bound)) &&
        (row.operator === '<=' || holds(row.coefficients.map(neg), neg(row.bound)))) redundant.push(row.id);
  }
  const constraints = [...model.constraints, {
    id: 'cara-óptima', coefficients: model.objective, bound: solution.value, operator: '='
  }];
  for (const j of model.variables.keys()) for (const sense of ['max', 'min']) {
    const objective = model.variables.map((_, i) => i === j ? one : zero);
    const extreme = solveSimplex({ ...model, constraints, objective, sense });
    if (extreme.status === 'unbounded') return { redundant, optimalRay: extreme.ray };
    if (extreme.status === 'optimal' && compare(extreme.point[j], solution.point[j]) !== 0) {
      return { redundant, alternative: extreme.point };
    }
  }
  return { redundant };
}

export function certifyDualPair(primal, dual, x, y) {
  if (x.status !== 'optimal' || y.status !== 'optimal') return false;
  return validPoint(primal, x.point) && validPoint(dual, y.point) && compare(x.value, y.value) === 0 &&
    primal.constraints.every((row, i) => !multiply(subtract(row.bound, dot(row.coefficients, x.point)), y.point[i]).numerator) &&
    dual.constraints.every((row, j) => !multiply(subtract(row.bound, dot(row.coefficients, y.point)), x.point[j]).numerator);
}
