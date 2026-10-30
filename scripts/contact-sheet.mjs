// Rasterizes every generated SVG onto one PNG contact sheet for visual QA.
// Usage: node scripts/contact-sheet.mjs [filterSubstring] [outFile]
import sharp from 'sharp';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'assets', 'svg');
const filter = process.argv[2] ?? '';
const outFile = process.argv[3] ?? join(root, 'art-source', 'contact-sheet.png');
const cell = 150;
const files = readdirSync(dir).filter((n) => n.endsWith('.svg') && n.includes(filter)).sort();
const cols = Math.min(8, files.length);
const rows = Math.ceil(files.length / cols);

const composites = [];
for (let i = 0; i < files.length; i++) {
  const buf = await sharp(readFileSync(join(dir, files[i])), { density: 144 })
    .resize(cell - 10, cell - 10, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  composites.push({ input: buf, left: (i % cols) * cell + 5, top: Math.floor(i / cols) * cell + 5 });
}

await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: '#7d8fa3' } })
  .composite(composites)
  .png()
  .toFile(outFile);
console.log(`${files.length} assets -> ${outFile}`);
console.log(files.map((n, i) => `${i}:${n.replace('.svg', '')}`).join('  '));
