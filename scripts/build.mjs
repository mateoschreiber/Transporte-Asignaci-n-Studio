import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = (name) => new URL('../' + name, import.meta.url);
const [template, style, bundle] = await Promise.all([
  readFile(file('src/index.template.html'), 'utf8'),
  readFile(file('src/styles.css'), 'utf8'),
  build({
    entryPoints: [fileURLToPath(file('src/ui/app.js'))],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome110', 'firefox115', 'safari16.4'],
    charset: 'utf8',
    write: false
  })
]);
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const scriptHash = createHash('sha256').update(script).digest('base64');
const html = template.replace('<!-- SCRIPT_HASH -->', () => scriptHash)
  .replace('<!-- STYLES -->', () => style)
  .replace('<!-- SCRIPT -->', () => script);
await mkdir(file('dist/'), { recursive: true });
await writeFile(file('dist/.assetsignore'), '*\n!/index.html\n', 'utf8');
await writeFile(file('dist/index.html'), html, 'utf8');
console.log('dist/index.html · ' + Buffer.byteLength(html).toLocaleString('es-PY') + ' bytes');
