import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build, transform } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from '../tailwind.config.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await mkdir(path.join(root, 'assets'), { recursive: true });
const hash = (content) => createHash('sha256').update(content).digest('hex').slice(0, 12);
const sourceHashes = {};
const sourceFiles = (await readdir('src', { recursive: true }))
  .filter((filename) => /\.(?:jsx|js|mjs|css|html)$/.test(filename))
  .map((filename) => `src/${filename.replaceAll('\\', '/')}`);
for (const filename of new Set([...sourceFiles, 'src/ui.css', 'tailwind.config.cjs', 'package-lock.json'])) {
  sourceHashes[filename] = await readFile(filename).then(hash).catch((error) => {
    if (error.code === 'ENOENT' && filename === 'src/ui.css') return null;
    throw error;
  });
}

const jsResult = await build({
  absWorkingDir: root,
  entryPoints: ['src/game.jsx'],
  outfile: 'assets/game.js',
  bundle: true,
  minify: true,
  format: 'esm',
  charset: 'utf8',
  platform: 'browser',
  target: ['es2020'],
  inject: ['src/react-shim.js'],
  external: ['firebase/*'],
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'linked',
  metafile: true,
  logLevel: 'warning',
});

const baseCss = await readFile('src/base.css', 'utf8');
// ui.css is authored separately and deliberately follows all Tailwind utilities.
const uiCss = await readFile('src/ui.css', 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return '';
  throw error;
});
const cssResult = await postcss([tailwindcss(tailwindConfig), autoprefixer()])
  .process(`${baseCss}\n${uiCss}`, { from: 'src/base.css', to: 'assets/game.css' });
const minifiedCss = await transform(cssResult.css, {
  loader: 'css', minify: true, target: ['chrome100', 'firefox100', 'safari15'],
  legalComments: 'inline',
});
await writeFile('assets/game.css', minifiedCss.code);

const js = await readFile('assets/game.js');
const css = await readFile('assets/game.css');
const html = (await readFile('src/index.template.html', 'utf8'))
  .replaceAll('__JS_HASH__', hash(js)).replaceAll('__CSS_HASH__', hash(css));
await writeFile('index.html', html);
await writeFile('assets/build-info.json', `${JSON.stringify({
  entry: 'src/game.jsx',
  sourceHashes,
  javascript: { file: 'assets/game.js', bytes: js.length, hash: hash(js) },
  stylesheet: { file: 'assets/game.css', bytes: css.length, hash: hash(css) },
  htmlBytes: Buffer.byteLength(html),
  externalImports: Object.values(jsResult.metafile.outputs).flatMap((output) =>
    output.imports.filter((item) => item.external).map((item) => item.path)),
}, null, 2)}\n`);
console.log(`Built index.html (${Buffer.byteLength(html)} B), game.js (${js.length} B), game.css (${css.length} B).`);
