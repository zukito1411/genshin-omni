// Mechanical derivatives of the existing logo; no new artwork or runtime library.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PNG } = require(path.join(root, 'node_modules/playwright-core/lib/utilsBundle.js'));
const { encodeWebp, decodeWebp } = require(path.join(root, 'node_modules/playwright-core/lib/coreBundle.js')).utils;
const source = PNG.sync.read(fs.readFileSync(path.join(root, 'public/assets/logo.png')));
if (source.width !== source.height) throw new Error('The source logo must be square.');

function resize(size) {
  const image = { width: size, height: size, data: Buffer.alloc(size * size * 4) };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = x * source.width / size, right = (x + 1) * source.width / size;
    const top = y * source.height / size, bottom = (y + 1) * source.height / size;
    let alpha = 0, red = 0, green = 0, blue = 0;
    for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy++) for (let sx = Math.floor(left); sx < Math.ceil(right); sx++) {
      const weight = (Math.min(right, sx + 1) - Math.max(left, sx)) * (Math.min(bottom, sy + 1) - Math.max(top, sy));
      const index = (sy * source.width + sx) * 4;
      const opacity = source.data[index + 3] * weight;
      alpha += opacity; red += source.data[index] * opacity; green += source.data[index + 1] * opacity; blue += source.data[index + 2] * opacity;
    }
    const index = (y * size + x) * 4;
    if (alpha) { image.data[index] = Math.round(red / alpha); image.data[index + 1] = Math.round(green / alpha); image.data[index + 2] = Math.round(blue / alpha); }
    image.data[index + 3] = Math.round(alpha / ((right - left) * (bottom - top)));
  }
  return image;
}
function canvas(size, artworkSize) {
  // Preserve the full 500px source at native resolution on a 512px canvas.
  // A 288px logo on 512px fits entirely inside the maskable 40%-radius circle.
  const artwork = artworkSize === source.width ? source : resize(artworkSize);
  const image = { width: size, height: size, data: Buffer.alloc(size * size * 4) };
  const offset = Math.floor((size - artworkSize) / 2);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4;
    image.data.set([7, 17, 28, 255], index);
    if (x < offset || y < offset || x >= offset + artworkSize || y >= offset + artworkSize) continue;
    const sourceIndex = ((y - offset) * artworkSize + x - offset) * 4;
    const opacity = artwork.data[sourceIndex + 3] / 255;
    for (let channel = 0; channel < 3; channel++) image.data[index + channel] = Math.round(artwork.data[sourceIndex + channel] * opacity + image.data[index + channel] * (1 - opacity));
  }
  return image;
}
function write(name, image, webp = false) {
  const output = webp ? encodeWebp(image, { lossless: true, quality: 100 }) : PNG.sync.write(image);
  const verified = webp ? decodeWebp(output) : PNG.sync.read(output);
  if (verified.width !== image.width || verified.height !== image.height) throw new Error('Icon dimensions changed.');
  for (let index = 0; index < image.data.length; index += 4) {
    if (verified.data[index + 3] !== image.data[index + 3] || (image.data[index + 3] && !image.data.subarray(index, index + 3).equals(verified.data.subarray(index, index + 3)))) throw new Error('Visible pixels changed during encoding.');
  }
  fs.writeFileSync(path.join(root, 'public/assets', name), output);
  console.log(`${name}: ${image.width}x${image.height}, ${output.length} bytes`);
}
write('app-icon-192-v1.png', canvas(192, 192));
write('app-icon-512-v1.png', canvas(512, Math.min(500, source.width)));
write('app-icon-maskable-512-v1.png', canvas(512, 288));
write('apple-touch-icon-v1.png', canvas(180, 180));
for (const size of [32, 64, 96, 128]) {
  const image = resize(size);
  write(`logo-${size}-v1.png`, image);
  write(`logo-${size}-v1.webp`, image, true);
}
