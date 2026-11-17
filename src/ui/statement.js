import { getExercise } from '../data/exercises.js';
import { originalStatements } from '../data/statements.js';
import { el } from './dom.js';
import { matrixTable, sourceMatrix } from './table.js';

const paragraphs = (blocks = []) => blocks.map((block) => Array.isArray(block)
  ? el('ul', {}, block.map((line) => el('li', {}, line))) : el('p', {}, block));

export function exerciseStatement(exercise, { compact = false, heading = 'h3', focusable = false } = {}) {
  const section = { class: 'exercise-statement', tabindex: focusable ? '-1' : null };
  const original = originalStatements[exercise.id];
  if (!original) return el('section', section,
    el(heading, {}, 'Enunciado · ejemplo propio'), el('p', {}, exercise.text));

  const source = exercise.id === 'metro' ? 'Clase15.pdf · pág. 1' : exercise.source + ' · pág. ' + exercise.page;
  const { table, tableExercise } = original;
  const data = table ? el('div', {}, el('p', { class: 'meta dim' }, table.caption),
    matrixTable(table.rows, table.columns, (i, j) => table.values[i][j], { rowPrefix: table.rowPrefix, label: table.caption })) :
    sourceMatrix(tableExercise ? getExercise(tableExercise).draft : exercise.draft);
  const originalData = compact ? el('details', {}, el('summary', {}, 'Ver datos del enunciado'), data) : data;

  return el('section', section,
    el('div', { class: 'statement-original' },
      el(heading, {}, 'Enunciado original'),
      el('p', { class: 'meta dim' }, [source, original.reference].filter(Boolean).join(' · ')),
      paragraphs(original.before), originalData, paragraphs(original.after)),
    el('div', { class: 'statement-adapted' },
      el(heading, {}, 'Versión adaptada'),
      el('p', {}, exercise.text)));
}

export function hasAdaptedTable(exercise) {
  const original = originalStatements[exercise.id];
  return !original || Boolean(original.table || original.tableExercise);
}
