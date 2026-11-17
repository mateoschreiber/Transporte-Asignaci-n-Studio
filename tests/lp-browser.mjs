import assert from 'node:assert/strict';
import { copyFile, mkdtemp, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const directory = await mkdtemp(join(tmpdir(), 'studio-lp-'));
const file = join(directory, 'index.html');
await copyFile(new URL('../dist/index.html', import.meta.url), file);
const base = pathToFileURL(file).href;
async function checkLayout(page) {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
  }
  await page.setViewportSize({ width: 320, height: 820 });
}
try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ offline: true, viewport: { width: 320, height: 820 }, reducedMotion: 'reduce' });
      const errors = [];
      const external = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => { if (/^https?:/.test(request.url())) external.push(request.url()); });
      await page.goto(base + '#grafico');
      await page.getByRole('heading', { name: 'Método Gráfico', level: 1 }).waitFor();
      await page.getByRole('button', { name: 'Aprender', exact: true }).click();
      await page.getByText('Óptimo · (30, 40) · Z = 410', { exact: true }).waitFor();
      await checkLayout(page);
      await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      await page.getByRole('button', { name: 'Practicar', exact: true }).click();
      for (const [name, answer] of [[/Dominio de X1/, '1'], [/Coeficiente de X1/, '7'],
        [/Dominio de X2/, '1'], [/Coeficiente de X2/, '5'], [/R1 · Escribe/, '-8 | -6 | >= | -480']]) {
        await page.getByRole('textbox', { name }).fill(answer);
        await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
      }
      await page.getByRole('textbox', { name: /R1 · Semiplano/ }).waitFor();
      await page.reload();
      await page.getByRole('button', { name: 'Reanudar práctica', exact: true }).click();
      await page.getByRole('textbox', { name: /R1 · Semiplano/ }).waitFor();
      await page.getByRole('button', { name: 'Abrir en Método Simplex', exact: true }).click();
      await page.getByRole('heading', { name: 'Método Simplex', level: 1 }).waitFor();
      await page.getByLabel('Ejercicio', { exact: true }).selectOption('alimentos');
      await page.getByRole('button', { name: 'Aprender', exact: true }).click();
      await page.getByText('Óptimo · (4/9, 7/18) · Z = 670/9', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Siguiente →', exact: true }).click();
      await page.getByRole('button', { name: /^Zj de X1,/ }).click();
      await page.getByText(/Zj de X1 = .*×/).waitFor();
      await checkLayout(page);
      await page.getByRole('button', { name: 'Modo oscuro', exact: true }).click();
      await checkLayout(page);
      await page.getByRole('button', { name: 'Modo claro', exact: true }).click();
      await page.getByLabel('Ejercicio', { exact: true }).selectOption('practica-max');
      await page.getByRole('button', { name: 'Aprender', exact: true }).click();
      await page.getByLabel('Seleccionar paso', { exact: true }).selectOption('2');
      await page.getByText('Z de las variables originales = 20000', { exact: true }).waitFor();
      await page.getByRole('button', { name: /^Zj de X1,/ }).click();
      await page.getByText('Zj de X1 = (4) × (1) + (0) × (0) + (0) × (0) + (0) × (0) = 4', { exact: true }).waitFor();
      await page.getByLabel('Ejercicio', { exact: true }).selectOption('alimentos');
      await page.getByRole('button', { name: 'Aprender', exact: true }).click();
      await page.getByRole('button', { name: 'Ver primal y dual', exact: true }).click();
      await page.getByText(/Dualidad fuerte/).waitFor();
      await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
      await page.getByRole('combobox', { name: 'Filtrar por método' }).selectOption('simplex');
      await page.getByRole('combobox', { name: 'Filtrar por objetivo' }).selectOption('min');
      await page.getByRole('combobox', { name: 'Filtrar por conocimientos' }).selectOption('Dualidad');
      assert.equal(await page.locator('main article.card').count(), 2);
      await page.getByRole('link', { name: 'Examen', exact: true }).click();
      await page.getByRole('heading', { name: 'Examen simulado', exact: true }).waitFor();
      await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('mixed-general');
      await page.getByRole('button', { name: 'Iniciar examen de 20 min' }).click();
      assert.equal(await page.locator('main section[aria-label]').count(), 4);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
      await page.getByRole('button', { name: 'Entregar examen' }).click();
      await page.getByRole('heading', { name: 'Resultado · Mixto general' }).waitFor();
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
      console.log(engine.name() + ' · Gráfico, Simplex, transferencia, dual y examen offline');
    } finally {
      await browser.close();
    }
  }
} finally {
  await unlink(file);
  await rmdir(directory);
}
