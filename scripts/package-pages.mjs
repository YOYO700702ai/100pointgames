import { mkdir, readdir, copyFile, lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.pages-dist');
try { await lstat(output); throw new Error('Output already exists. Use a fresh checkout or a new empty .pages-dist directory.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(output);
const entries = ["index.html", "admin.html", "mobile.html"];
const copied = [];
async function copy(relative) {
  const source = path.join(root, relative);
  const stat = await lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Not a regular file: ${relative}`);
  const dest = path.join(output, relative);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(source, dest);
  copied.push(relative);
}
for (const entry of entries) await copy(entry);
async function assets(dir) {
  for (const item of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${item.name}`;
    if (item.isSymbolicLink()) throw new Error(`Symlink forbidden: ${relative}`);
    if (item.isDirectory()) await assets(relative);
    else if (/\.(?:webp|png|jpg|jpeg|svg|css|js)$/i.test(item.name) || item.name === 'game.js.LEGAL.txt') await copy(relative);
  }
}
await assets('assets');
await writeFile(path.join(output, '.nojekyll'), '');
console.log(JSON.stringify({ files: copied.length, paths: copied }, null, 2));
