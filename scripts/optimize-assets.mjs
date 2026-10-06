// Mechanical, lossless asset encoding. Originals are retained as browser fallbacks.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PNG } = require(path.join(root, 'node_modules/playwright-core/lib/utilsBundle.js'));
const { encodeWebp, decodeWebp } = require(path.join(root, 'node_modules/playwright-core/lib/coreBundle.js')).utils;

function encode(source, target, image = PNG.sync.read(fs.readFileSync(path.join(root, source)))) {
  const output = encodeWebp(image, { lossless: true, quality: 100 });
  const verified = decodeWebp(output);
  if (image.width !== verified.width || image.height !== verified.height) throw new Error('Asset dimensions changed.');
  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index + 3] !== verified.data[index + 3] || (image.data[index + 3] && !image.data.subarray(index, index + 3).equals(verified.data.subarray(index, index + 3)))) throw new Error('Visible asset pixels changed.');
  }
  fs.writeFileSync(path.join(root, target), output);
  console.log(`${target}: ${output.length} bytes; visible RGBA pixels verified lossless`);
}
encode('public/assets/logo.png', 'public/assets/logo.webp');
encode('public/paimon/spritesheet.png', 'public/paimon/spritesheet.webp');
// A favicon is shown at icon sizes, never as full-resolution page artwork.
// Area-filter the original logo with premultiplied alpha to retain smooth edges.
const logo = PNG.sync.read(fs.readFileSync(path.join(root, 'public/assets/logo.png')));
const favicon = { width: 64, height: 64, data: Buffer.alloc(64 * 64 * 4) };
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
  const left = x * logo.width / 64, right = (x + 1) * logo.width / 64;
  const top = y * logo.height / 64, bottom = (y + 1) * logo.height / 64;
  let alpha = 0, red = 0, green = 0, blue = 0;
  for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy++) for (let sx = Math.floor(left); sx < Math.ceil(right); sx++) {
    const weight = (Math.min(right, sx + 1) - Math.max(left, sx)) * (Math.min(bottom, sy + 1) - Math.max(top, sy));
    const index = (sy * logo.width + sx) * 4;
    const opacity = logo.data[index + 3] * weight;
    alpha += opacity; red += logo.data[index] * opacity; green += logo.data[index + 1] * opacity; blue += logo.data[index + 2] * opacity;
  }
  const index = (y * 64 + x) * 4;
  if (alpha) { favicon.data[index] = Math.round(red / alpha); favicon.data[index + 1] = Math.round(green / alpha); favicon.data[index + 2] = Math.round(blue / alpha); }
  favicon.data[index + 3] = Math.round(alpha / ((right - left) * (bottom - top)));
}
const icon = PNG.sync.write(favicon);
fs.writeFileSync(path.join(root, 'public/assets/favicon.png'), icon);
console.log(`public/assets/favicon.png: ${icon.length} bytes; original artwork at favicon resolution`);
const sheet = PNG.sync.read(fs.readFileSync(path.join(root, 'public/paimon/spritesheet.png')));
const size = Math.ceil(sheet.width / 8) + 1;
const face = { width: size, height: size, data: Buffer.alloc(size * size * 4) };
for (let y = 0; y < size; y++) sheet.data.copy(face.data, y * size * 4, y * sheet.width * 4, (y * sheet.width + size) * 4);
encode('public/paimon/spritesheet.png', 'public/paimon/face.webp', face);
fs.writeFileSync(path.join(root, 'public/paimon/face.png'), PNG.sync.write(face));
console.log(`Face background size (same scale as original atlas): ${size * 496 / sheet.width}px`);
