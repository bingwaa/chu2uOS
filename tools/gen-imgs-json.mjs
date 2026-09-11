// 扫描 assets/imgs 下的子目录，重建 assets/imgs.json 清单。
// 访达（Finder）与开屏图依赖该清单，新增图片后必须重建。
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(root, 'assets', 'imgs');
const OUT = join(root, 'assets', 'imgs.json');
const EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

const dirs = readdirSync(IMG_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.'))
  .map(d => d.name);

const filesOf = dir =>
  readdirSync(join(IMG_DIR, dir), { withFileTypes: true })
    .filter(f => f.isFile() && EXT.test(f.name))
    .map(f => f.name)
    .sort(natural);

let prev = {};
if (existsSync(OUT)) {
  try { prev = JSON.parse(readFileSync(OUT, 'utf8')); } catch { prev = {}; }
}

// 已登记的目录保持原有顺序，新目录按自然序追加到末尾。
const order = [
  ...Object.keys(prev).filter(k => dirs.includes(k)),
  ...dirs.filter(d => !(d in prev)).sort(natural)
];

const next = {};
for (const d of order) next[d] = filesOf(d);
const text = JSON.stringify(next, null, 2) + '\n';

if (existsSync(OUT) && readFileSync(OUT, 'utf8') === text) {
  console.log('imgs.json 已是最新');
  process.exit(0);
}

writeFileSync(OUT, text);
const diff = [];
for (const d of order) {
  const before = prev[d] || [];
  for (const f of next[d]) if (!before.includes(f)) diff.push(`+ ${d}/${f}`);
  for (const f of before) if (!next[d].includes(f)) diff.push(`- ${d}/${f}`);
}
for (const d of Object.keys(prev)) if (!(d in next)) diff.push(`- ${d}/（整个目录已不存在）`);
console.log('imgs.json 已更新：\n' + (diff.join('\n') || '（仅顺序变化）'));
