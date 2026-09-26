import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transform } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const html = await readFile('index.html', 'utf8');
const jsx = await readFile('src/game.jsx', 'utf8');
const js = await readFile('assets/game.js', 'utf8');
const css = await readFile('assets/game.css', 'utf8');
const info = JSON.parse(await readFile('assets/build-info.json', 'utf8'));
for (const [filename, expectedHash] of Object.entries(info.sourceHashes)) {
  const content = await readFile(filename).catch((error) => {
    if (error.code === 'ENOENT' && filename === 'src/ui.css') return null;
    throw error;
  });
  const actualHash = content === null ? null : createHash('sha256').update(content).digest('hex').slice(0, 12);
  assert.equal(actualHash, expectedHash, `${filename} changed since the last build; run npm run build.`);
}
await transform(jsx, { loader: 'jsx', target: 'es2020' });
await transform(js, { loader: 'js', target: 'es2020' });
await transform(css, { loader: 'css' });
assert(!/text\/babel|cdn\.tailwindcss\.com|@babel\/standalone|unpkg\.com\/react/.test(html), 'Browser compilers or CDN React remain.');
assert(!/__JS_HASH__|__CSS_HASH__/.test(html), 'Unresolved build placeholders.');
assert(html.includes('<html lang="zh-TW">'), 'Document language must be Traditional Chinese.');
assert(!/user-scalable=no|maximum-scale=1[" ,]/.test(html), 'Viewport must permit zoom.');
for (const [kind, asset] of Object.entries(info)) {
  if (!asset?.file) continue;
  const content = await readFile(asset.file);
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
  assert.equal(hash, asset.hash, `${kind} hash does not match; rebuild.`);
  assert.equal(content.length, asset.bytes, `${kind} byte count does not match; rebuild.`);
  assert(html.includes(`${asset.file}?v=${hash}`), `${kind} is not linked from index.html.`);
}
const importmapText = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
assert(importmapText, 'Firebase importmap missing.');
const imports = JSON.parse(importmapText).imports;
for (const module of ['app', 'auth', 'firestore']) {
  assert.equal(imports[`firebase/${module}`], `https://www.gstatic.com/firebasejs/10.11.1/firebase-${module}.js`);
}
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']|import\(["']([^"']+)["']\)/g)) {
  const url = match[1] || match[2];
  if (/^(?:https?:|data:|#)/.test(url)) continue;
  const asset = decodeURIComponent(url.split(/[?#]/)[0]);
  const resolved = path.resolve(root, asset);
  assert(resolved.startsWith(root), `Local reference leaves project: ${url}`);
  assert((await stat(resolved)).isFile(), `Missing local reference: ${url}`);
}
assert(info.externalImports.every((name) => /^firebase\/(app|auth|firestore)$/.test(name)), 'Unexpected external JavaScript dependency.');
assert(css.includes('.game-boot'), 'Boot screen styles missing.');
const artReferences = new Set([...jsx.matchAll(/assets\/art\/[a-z0-9-]+\.webp/g)].map((match) => match[0]));
for (const filename of artReferences) assert((await stat(filename)).isFile(), `Missing artwork: ${filename}`);
console.log(`PASS: JSX/JS/CSS syntax, current source hashes, local references (${artReferences.size} artwork), content hashes, Firebase imports, viewport, and removed browser compilers.`);
