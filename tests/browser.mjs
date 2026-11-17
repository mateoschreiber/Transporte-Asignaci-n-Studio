import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { chromium, firefox, webkit } from 'playwright';
import { emptyState, STORAGE_KEY } from '../src/state/progress.js';
import { assignmentModel } from '../src/core/assignment-model.js';
import { solveHungarian } from '../src/core/hungarian.js';
import { transportModel } from '../src/core/transport-model.js';
import { solveInitial } from '../src/core/transport-initial.js';
import { solveModi } from '../src/core/modi.js';
import { exerciseDraft, getExercise } from '../src/data/exercises.js';

const destination = await mkdtemp(join(tmpdir(), 'studio-offline-'));
const copy = join(destination, 'index.html');
await copyFile(new URL('../dist/index.html', import.meta.url), copy);
const offlineUrl = pathToFileURL(copy).href;
const captureDir = process.env.STUDIO_CAPTURE_DIR;

try {
  for (const [name, engine, narrow] of [['Chromium', chromium, 390], ['Firefox', firefox, 360], ['WebKit', webkit, 390]]) {
    const only = process.env.STUDIO_BROWSER;
    if (only && only !== name) continue;
    await test(name + ' · archivo aislado, escritorio y móvil', { timeout: 90_000 }, async () => {
      const browser = await engine.launch();
      const context = await browser.newContext({ offline: true, acceptDownloads: true, viewport: { width: 1440, height: 940 } });
      const page = await context.newPage();
      page.setDefaultTimeout(4500);
      const errors = [];
      const requests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', (request) => { if (request.url() !== offlineUrl && !request.url().startsWith('blob:')) requests.push(request.url()); });
      try {
        await page.goto(offlineUrl);
        await page.getByRole('heading', { name: 'Investigación de Operaciones Studio', exact: true }).waitFor();
        if (captureDir && name === 'Chromium') {
          await mkdir(captureDir, { recursive: true });
          await page.screenshot({ path: join(captureDir, 'inicio-escritorio.png'), fullPage: true });
        }
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Saltar al contenido');
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'contenido');
        await page.setViewportSize({ width: narrow, height: 840 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await assertNoOverflow(page);
        if (captureDir && name === 'Chromium') await page.screenshot({ path: join(captureDir, 'inicio-movil.png'), fullPage: true });
        await page.getByRole('button', { name: 'Modo oscuro' }).click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
        if (captureDir && name === 'Chromium') await page.screenshot({ path: join(captureDir, 'inicio-movil-oscuro.png'), fullPage: true });
        await page.getByRole('button', { name: 'Modo claro' }).click();
        await page.getByRole('button', { name: 'Abrir Mataderos' }).click();
        const cost = page.getByRole('textbox', { name: 'Costo fila 1, columna 1', exact: true });
        await cost.fill('');
        await page.getByText('Ingresa un número válido en la celda P / R.', { exact: true }).waitFor();
        assert.equal(await cost.getAttribute('aria-invalid'), 'true');
        await cost.fill('1,0');
        await page.getByText('Matriz y márgenes completos.', { exact: true }).waitFor();
        assert.equal(await cost.getAttribute('aria-invalid'), null);
        await page.getByRole('button', { name: 'Agregar fila', exact: true }).click();
        assert.equal(await page.getByRole('textbox', { name: 'Costo fila 3, columna 1', exact: true }).getAttribute('aria-invalid'), 'true');
        await page.getByRole('button', { name: 'Quitar última fila', exact: true }).click();
        await page.getByLabel('Cambiar ejercicio').selectOption('abc');
        await page.getByLabel('Optimizar con MODI').check();
        await page.getByRole('button', { name: 'Aprender', exact: true }).click();
        await page.getByRole('heading', { name: 'Balancear el modelo' }).waitFor();
        await jumpLast(page);
        await page.getByText('Z = 575 = Σ Sᵢ Uᵢ + Σ Dⱼ Vⱼ', { exact: true }).waitFor();
        await page.getByText('Ver otro reparto óptimo', { exact: true }).click();
        await assertNoOverflow(page);
        if (captureDir && name === 'Chromium') {
          await page.setViewportSize({ width: 1440, height: 940 });
          await page.screenshot({ path: join(captureDir, 'modi-escritorio.png'), fullPage: true });
          await page.setViewportSize({ width: narrow, height: 840 });
        }
        await page.getByRole('button', { name: '← Anterior', exact: true }).click();
        await page.getByRole('heading', { name: 'Evaluar costos reducidos' }).waitFor();
        await page.getByRole('button', { name: 'Reiniciar', exact: true }).click();
        await page.getByRole('heading', { name: 'Balancear el modelo' }).waitFor();
        await practiceVogel(page);
        await practiceModi(page);
        await page.getByRole('link', { name: 'Asignación', exact: true }).click();
        await page.getByRole('button', { name: 'Aprender', exact: true }).click();
        await jumpLast(page);
        await page.getByText('Z = 54 + 81 + 46 + 38 = 219', { exact: true }).waitFor();
        await practiceHungarian(page);
        await page.getByLabel('Cambiar ejercicio').selectOption('propio-infactible');
        await page.getByRole('button', { name: 'Aprender', exact: true }).click();
        await jumpLast(page);
        await page.getByRole('heading', { name: 'Asignación infactible' }).waitFor();
        await page.getByLabel('Cambiar ejercicio').selectOption('job-c');
        await page.getByRole('button', { name: 'Comparar con JobShop original' }).click();
        await page.getByText('80', { exact: true }).last().waitFor();
        await fullExam(page);
        await page.getByRole('link', { name: 'Repaso', exact: true }).click();
        await page.locator('#study-toggle').click();
        await page.locator('#study-toggle').click();
        await page.locator('#module-fundamentos').click();
        await page.getByText('20 de 300 minutos en módulos completados.', { exact: true }).waitFor();
        await restoreSession(page);
        assert.deepEqual(requests, []);
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
        await browser.close();
      }
    });
  }
} finally {
  await unlink(copy);
  await rmdir(destination);
}

async function assertNoOverflow(page) {
  const within = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert.equal(within, true, 'El contenido debe ajustarse al ancho de la ventana.');
}

async function jumpLast(page) {
  const picker = page.getByLabel('Seleccionar paso');
  await picker.selectOption({ index: (await picker.locator('option').count()) - 1 });
}

async function confirm(page) {
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar →', exact: true }).click();
}

async function practiceVogel(page) {
  await page.getByLabel('Cambiar ejercicio').selectOption('sbf-a');
  await page.getByLabel('Método de Transporte').selectOption('vogel');
  await page.getByRole('button', { name: 'Practicar', exact: true }).click();
  await page.getByLabel('Oferta menos demanda').fill('1');
  await page.getByLabel('Ajuste necesario').selectOption('none');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByText('Revisa el cálculo de «Oferta menos demanda».', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Continuar →', exact: true }).isVisible(), false);
  await page.getByRole('button', { name: 'Pista', exact: true }).click();
  await page.getByText('Resta la demanda total a la oferta total.', { exact: true }).waitFor();
  await page.getByLabel('Oferta menos demanda').fill('0');
  await confirm(page);
  for (const [label, reply] of [['Fila A', '1'], ['Fila B', '1'], ['Fila C', '1'], ['Columna D', '2'], ['Columna E', '1'], ['Columna F', '2']]) {
    await page.locator('.practice-fields').getByLabel(label, { exact: true }).fill(reply);
  }
  await confirm(page);
  await page.getByRole('combobox', { name: 'Fila o columna', exact: true }).selectOption({ label: 'Columna F' });
  await confirm(page);
  await page.getByRole('button', { name: /Seleccionar A → F/ }).click();
  await confirm(page);
  await page.getByLabel('Unidades a asignar').fill('6');
  await confirm(page);
  await page.getByText('x 6', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ver resolución', exact: true }).click();
  await page.getByRole('button', { name: 'Volver a la práctica', exact: true }).click();
  await page.getByText('x 6', { exact: true }).waitFor();
}

async function practiceHungarian(page) {
  const model = assignmentModel(exerciseDraft(getExercise('maquinas')));
  const reference = solveHungarian(model);
  const panel = page.getByRole('region', { name: 'Practicar paso a paso' });
  await page.getByRole('button', { name: 'Practicar', exact: true }).click();
  await page.getByLabel('Número de filas después de balancear').fill('4');
  await confirm(page);
  await page.getByLabel('Estado del modelo').selectOption('yes');
  await confirm(page);
  for (const step of reference.steps) {
    if (step.kind === 'reduction') {
      await panel.getByLabel('Mínimo', { exact: true }).fill(String(step.minimum));
      await confirm(page);
    }
    if (step.kind === 'cover') {
      for (const [name, labels, flags] of [['Fila', model.rows, step.rows], ['Columna', model.columns, step.columns]]) {
        for (let i = 0; i < model.size; i++) {
          if (flags[i]) await panel.getByLabel(name + ' ' + labels[i], { exact: true }).check();
        }
      }
      await confirm(page);
      await panel.getByRole('combobox', { name: 'Siguiente operación', exact: true }).selectOption(step.matching.size === model.size ? 'pairs' : 'adjust');
      await confirm(page);
    }
    if (step.kind === 'adjustment') {
      await panel.getByLabel('δ', { exact: true }).fill(String(step.minimum));
      await confirm(page);
    }
  }
  for (const pair of reference.pairs) await panel.locator('[data-cell="' + pair.i + '-' + pair.j + '"] button').click();
  await confirm(page);
  await panel.getByLabel('Z de la asignación').fill('219');
  await confirm(page);
  await panel.getByRole('heading', { name: 'Asignación óptima', exact: true }).waitFor();
}

async function practiceModi(page) {
  const model = transportModel(exerciseDraft(getExercise('mataderos')));
  const initial = solveInitial(model, 'northwest');
  const optimal = solveModi(model, initial.state);
  await page.getByLabel('Cambiar ejercicio').selectOption('mataderos');
  await page.getByLabel('Optimizar con MODI').check();
  await page.getByRole('button', { name: 'Practicar', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Practicar paso a paso' });
  const clickCell = (i, j) => panel.locator('[data-cell="' + i + '-' + j + '"] button').click();
  await panel.getByLabel('Oferta menos demanda').fill('0');
  await panel.getByRole('combobox', { name: 'Ajuste necesario', exact: true }).selectOption('none');
  await confirm(page);
  for (const step of initial.steps) if (step.kind === 'allocation') {
    await clickCell(step.choice.i, step.choice.j);
    await confirm(page);
    await panel.getByLabel('Unidades a asignar').fill(String(step.choice.quantity));
    await confirm(page);
  }
  await panel.getByLabel('Z de la SBF').fill('68');
  await confirm(page);
  for (const step of optimal.steps) {
    if (step.kind === 'potentials') {
      for (let i = 0; i < model.m; i++) if (!step.anchors.includes(i)) {
        await panel.getByLabel('U' + (i + 1) + ' · ' + model.rows[i], { exact: true }).fill(String(step.potentials.rows[i]));
      }
      for (let j = 0; j < model.n; j++) if (!step.anchors.includes(model.m + j)) {
        await panel.getByLabel('V' + (j + 1) + ' · ' + model.columns[j], { exact: true }).fill(String(step.potentials.columns[j]));
      }
      await confirm(page);
    }
    if (step.kind === 'reduced') {
      for (let i = 0; i < model.m; i++) for (let j = 0; j < model.n; j++) {
        if (!step.before.basis[i][j]) {
          await panel.getByLabel('r · ' + model.rows[i] + ' → ' + model.columns[j], { exact: true }).fill(String(step.reduced[i][j]));
        }
      }
      await confirm(page);
      if (step.choice) await clickCell(step.choice.i, step.choice.j);
      else await panel.getByRole('combobox', { name: 'Estado de la SBF', exact: true }).selectOption('optimal');
      await confirm(page);
    }
    if (step.kind === 'cycle') {
      for (const { i, j } of step.cycle.slice(1).reverse()) await clickCell(i, j);
      await confirm(page);
      await panel.getByLabel('θ', { exact: true }).fill(String(step.theta));
      await confirm(page);
    }
    if (step.kind === 'pivot') {
      await clickCell(step.leaving.i, step.leaving.j);
      await confirm(page);
      for (const { i, j } of step.cycle.slice(0, 4)) {
        await panel.getByLabel('Cantidad nueva · ' + model.rows[i] + ' → ' + model.columns[j], { exact: true })
          .fill(String(step.after.allocation[i][j]));
      }
      await panel.getByLabel('ΔZ', { exact: true }).fill(String(step.delta));
      await confirm(page);
    }
  }
  await panel.getByText('Z = 56 = Σ Sᵢ Uᵢ + Σ Dⱼ Vⱼ', { exact: true }).waitFor();
}

async function fullExam(page) {
  await page.clock.install({ time: new Date('2026-11-17T15:00:00Z') });
  await page.getByRole('link', { name: 'Examen', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('transport');
  await page.getByRole('button', { name: 'Iniciar examen de 20 min' }).click();
  await page.getByLabel('Balanceo necesario').selectOption('row');
  await page.getByLabel('Cantidad del ficticio').fill('30');
  await page.getByLabel('Z inicial por Esquina Noroeste').fill('735');
  await page.getByLabel('Costo Z del reparto').fill('575');
  await page.getByLabel('Condición de optimalidad en MODI').selectOption('nonnegative');
  for (const [i, j, amount] of [[1,2,5],[1,3,40],[2,1,50],[2,3,10],[3,2,40],[4,2,30]]) {
    await page.getByLabel('Cantidad fila ' + i + ', columna ' + j, { exact: true }).fill(String(amount));
  }
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await page.clock.fastForward(30_000);
  await page.getByRole('link', { name: 'Examen', exact: true }).click();
  assert.equal(await page.getByLabel('Cantidad del ficticio').inputValue(), '30');
  assert.ok((await page.locator('[data-exam-clock]').textContent()).startsWith('19:'));
  await page.getByRole('button', { name: 'Entregar examen', exact: true }).click();
  await page.getByText(/7 de 7 criterios correctos/).waitFor();
  await page.getByRole('button', { name: 'Revisar solución', exact: true }).click();
  await page.getByRole('heading', { name: 'Balancear el modelo' }).waitFor();
  await page.getByRole('button', { name: 'Elegir otro examen' }).click();
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('assignment');
  await page.getByRole('button', { name: 'Iniciar examen de 20 min' }).click();
  await page.clock.fastForward(20 * 60_000);
  await page.getByRole('heading', { name: 'Resultado · Asignación', exact: true }).waitFor();
}

async function restoreSession(page) {
  const backup = emptyState();
  backup.theme = 'dark';
  const size = 20;
  const labels = Array.from({ length: size }, (_, i) => String(i + 1));
  backup.drafts.transport = {
    topic: 'transport', rows: ['<img src=x>', ...labels.slice(1)], columns: labels,
    costs: labels.map((_, i) => labels.map((__, j) => i === j ? 0 : i + j + 1)),
    supply: Array(size).fill(1), demand: Array(size).fill(1)
  };
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  }, STORAGE_KEY).catch(async () => {
    await page.evaluate(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    });
  });
  await page.getByRole('button', { name: 'Mi sesión' }).click();
  const file = page.getByLabel('Archivo de sesión JSON');
  await file.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await page.getByRole('button', { name: 'Importar y reemplazar sesión' }).click();
  await page.getByText('El archivo no corresponde a una sesión válida de Studio.').waitFor();
  await file.setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Importar y reemplazar sesión' }).click();
  await page.getByRole('link', { name: 'Transporte', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Nombre de fila 1', exact: true }).inputValue(), '<img src=x>');
  assert.equal(await page.locator('img').count(), 0);
  assert.equal(await page.locator('.editor-table tbody tr').count(), size);
  await assertNoOverflow(page);
  await page.getByLabel('Optimizar con MODI').check();
  const started = performance.now();
  await page.getByRole('button', { name: 'Aprender', exact: true }).click();
  await jumpLast(page);
  await page.getByText('Z = 0 = Σ Sᵢ Uᵢ + Σ Dⱼ Vⱼ', { exact: true }).waitFor();
  console.log('Matriz 20 × 20, resolver y mostrar óptimo: ' + Math.round(performance.now() - started) + ' ms');
  await page.getByRole('button', { name: 'Mi sesión' }).click();
  await page.getByText(/almacenamiento local no está disponible/).waitFor();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar sesión JSON' }).click();
  assert.equal((await download).suggestedFilename(), 'sesion-transporte-asignacion.json');
}
