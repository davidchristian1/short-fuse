// Resizes the AI-generated factory-floor illustrations in art-source/generated
// to the game's logical resolutions and writes optimized copies to public/assets/bg.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'art-source', 'generated');
const outDir = join(root, 'public', 'assets', 'bg');
mkdirSync(outDir, { recursive: true });

const jobs = [
  { src: 'factory_floor_landscape.jpg', out: 'factory_floor_landscape.jpg', width: 1280, height: 720 },
  { src: 'factory_floor_portrait.jpg', out: 'factory_floor_portrait.jpg', width: 720, height: 1280 },
];

for (const job of jobs) {
  const info = await sharp(join(srcDir, job.src))
    .resize(job.width, job.height, { fit: 'cover', kernel: 'lanczos3' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(join(outDir, job.out));
  console.log(`${job.out}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
}
