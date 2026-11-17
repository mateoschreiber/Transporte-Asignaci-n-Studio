import { add, compare, fraction, multiply, parseRational, subtract } from './rational.js';

export const zero = fraction(0n);
export const one = fraction(1n);
export const neg = (value) => subtract(zero, value);
export const dot = (a, b) => a.reduce((sum, value, index) => add(sum, multiply(value, b[index])), zero);
export const flip = (operator) => ({ '<=': '>=', '>=': '<=', '=': '=' })[operator];

export function parseLP(draft) {
  const { variables, objective, constraints, sense } = draft;
  if (!['max', 'min'].includes(sense) || !Array.isArray(variables) || variables.length < 1 ||
      variables.length > 32 || !Array.isArray(objective) || objective.length !== variables.length ||
      !Array.isArray(constraints) || constraints.length > 32) throw new Error('Dimensiones o sentido inválidos.');
  if (variables.some(({ name, domain }) => !name.trim() || !['positive', 'negative', 'free'].includes(domain))) {
    throw new Error('Completa los nombres y dominios de las variables.');
  }
  return {
    ...draft, objective: objective.map(parseRational),
    constraints: constraints.map((row) => {
      if (!flip(row.operator) || row.coefficients.length !== variables.length) throw new Error('Restricción inválida.');
      return { ...row, coefficients: row.coefficients.map(parseRational), bound: parseRational(row.bound) };
    })
  };
}

export function validPoint(model, point, ray = false) {
  if (point.length !== model.variables.length) return false;
  return model.variables.every(({ domain }, i) => domain === 'free' ||
    (domain === 'positive' ? compare(point[i], zero) >= 0 : compare(point[i], zero) <= 0)) &&
    model.constraints.every(({ coefficients, bound, operator }) => {
      const sign = compare(dot(coefficients, point), ray ? zero : bound);
      return operator === '=' ? sign === 0 : operator === '<=' ? sign <= 0 : sign >= 0;
    });
}

export function dualLP(model) {
  const max = model.sense === 'max';
  return {
    name: 'Dual de ' + model.name,
    sense: max ? 'min' : 'max',
    variables: model.constraints.map(({ operator }, i) => ({
      name: 'Y' + (i + 1),
      domain: operator === '=' ? 'free' : (operator === '<=') === max ? 'positive' : 'negative'
    })),
    objective: model.constraints.map(({ bound }) => bound),
    constraints: model.variables.map(({ domain }, j) => ({
      id: 'D' + (j + 1),
      coefficients: model.constraints.map(({ coefficients }) => coefficients[j]),
      operator: domain === 'free' ? '=' : (domain === 'positive') === max ? '>=' : '<=',
      bound: model.objective[j]
    }))
  };
}
