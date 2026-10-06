import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { newsImageCandidates, newsImageUrl, responsiveNewsImage } from '../src/utils/newsImages';

const require = createRequire(import.meta.url);
const { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const { decodeWebp } = require('../node_modules/playwright-core/lib/coreBundle.js').utils;
const upload = 'https://upload-os-bbs.hoyolab.com/upload/2026/10/06/fixture-cover.jpg';
const illustration = (width = 1280, height = 560) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#19394c"/><circle cx="50%" cy="50%" r="25%" fill="#e9c978"/></svg>`;
async function mockHome(page: Page, item: object, fail?: (url: string) => boolean) {
  const images: string[] = [];
  await page.route('**/*', (route) => {
    const request = route.request();
    if (request.url().startsWith('http://127.0.0.1:4173')) return route.continue();
    if (request.resourceType() === 'image') {
      images.push(request.url());
      if (fail?.(request.url())) return route.fulfill({ status: 404 });
      const process = new URL(request.url()).searchParams.get('x-oss-process') ?? '';
      const width = Number(process.match(/w_(\d+)/)?.[1] ?? 1280);
      return route.fulfill({ contentType: 'image/svg+xml', body: illustration(width, width * 7 / 16) });
    }
    return route.fulfill({ status: 404 });
  });
  await page.route('https://feeds.c3kay.de/genshin.json', (route) => route.fulfill({ json: { items: [{ title: 'Test Genshin announcement', url: 'https://www.hoyolab.com/article/fixture', date_published: '2026-10-06T00:00:00Z', ...item }] } }));
  return images;
}

test('install artwork has exact PNG sizes, opaque backgrounds and a genuinely safe maskable area', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone' });
  expect(manifest.icons.map((icon: any) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
  for (const icon of [...manifest.icons, { src: '/assets/apple-touch-icon-v1.png', sizes: '180x180' }]) {
    const image = PNG.sync.read(readFileSync(`public${icon.src}`));
    const size = Number(icon.sizes.split('x')[0]);
    expect([image.width, image.height]).toEqual([size, size]);
    let opaque = true;
    for (let index = 3; index < image.data.length; index += 4) if (image.data[index] !== 255) opaque = false;
    expect(opaque).toBe(true);
    let safe = true;
    if (icon.purpose === 'maskable') for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) <= size * 0.4) continue;
      const index = (y * size + x) * 4;
      if (image.data[index] !== 7 || image.data[index + 1] !== 17 || image.data[index + 2] !== 28) safe = false;
    }
    expect(safe).toBe(true);
  }
  for (const size of [32, 64, 96, 128]) {
    const png = PNG.sync.read(readFileSync(`public/assets/logo-${size}-v1.png`));
    const webp = decodeWebp(readFileSync(`public/assets/logo-${size}-v1.webp`));
    expect([webp.width, webp.height]).toEqual([size, size]);
    let lossless = true;
    for (let index = 0; index < png.data.length; index += 4) if (webp.data[index + 3] !== png.data[index + 3] || (png.data[index + 3] && !webp.data.subarray(index, index + 3).equals(png.data.subarray(index, index + 3)))) lossless = false;
    expect(lossless).toBe(true);
  }
});

test('responsive URLs are bounded and never rewrite signed, cropped, foreign or unsafe images', () => {
  const candidate = responsiveNewsImage(`${upload}?x-oss-process=image%2Fresize%2Cs_1000%2Fformat%2Cwebp%2Fquality%2Cq_70`)!;
  expect(candidate.srcSet).toContain('2048w');
  expect(new URL(candidate.src).searchParams.get('x-oss-process')).toContain('w_640,h_280');
  for (const src of ['not-a-url', `http://${new URL(upload).host}${new URL(upload).pathname}`, `${upload}?signature=private`, `${upload}?x-oss-process=image%2Fcrop%2Cw_100`, 'https://unrelated.test/image.jpg']) expect(responsiveNewsImage(src)).toBeNull();
  expect(newsImageUrl('javascript:alert(1)')).toBeNull();
  expect(newsImageUrl('https://username:password@example.test/image.jpg')).toBeNull();
  expect(newsImageUrl('/cover.jpg', 'https://example.test/article')).toBe('https://example.test/cover.jpg');
});

test('artwork parsing is reused during rotation, invalidated on content changes, and tolerates unavailable HTML parsing', () => {
  const item = { image: 'https://images.test/first.jpg' };
  const first = newsImageCandidates(item);
  expect(first).toEqual([{ src: item.image }]);
  expect(newsImageCandidates(item)).toBe(first);
  item.image = 'https://images.test/second.jpg';
  expect(newsImageCandidates(item)).toEqual([{ src: item.image }]);
  expect(newsImageCandidates({ image: item.image, content_html: '<img src="https://images.test/article.jpg">' })).toEqual([{ src: item.image }]);
});

test('install metadata loads locally and high-density screens receive appropriately sized brand artwork', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await mockHome(page, { image: upload });
  await page.goto('http://127.0.0.1:4173/');
  const logo = page.getByRole('img', { name: 'Teyvat Atlas logo', exact: true });
  await expect(logo).toBeVisible();
  // naturalWidth is density-corrected when srcset is used; inspect the chosen
  // file rather than mistaking its CSS width for the raster's pixel dimensions.
  await expect.poll(() => logo.evaluate((node: HTMLImageElement) => node.currentSrc)).toContain('logo-96-v1.webp');
  const logoWidth = await logo.evaluate((node: HTMLImageElement) => node.getBoundingClientRect().width);
  expect(logoWidth).toBeGreaterThanOrEqual(28); expect(logoWidth).toBeLessThanOrEqual(32);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180');
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  expect((await response.json()).icons).toHaveLength(3);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((items) => items.length))).toBe(0);
  await context.close();
});

test('banner uses actual layout width and pixel density while preserving mobile and desktop geometry', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  const requests = await mockHome(page, { image: upload });
  await page.goto('http://127.0.0.1:4173/');
  const banner = page.locator('.news-banner-image img');
  await expect(banner).toBeVisible();
  await expect.poll(() => banner.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  const dimensions = await banner.evaluate((node: HTMLImageElement) => ({ natural: node.naturalWidth, width: node.clientWidth, height: node.clientHeight, sizes: node.sizes, current: node.currentSrc }));
  expect(dimensions.sizes).toBe(`${Math.ceil(dimensions.width)}px`);
  const selectedWidth = Number((new URL(dimensions.current).searchParams.get('x-oss-process') ?? '').match(/w_(\d+)/)?.[1]);
  expect(selectedWidth).toBeGreaterThanOrEqual(dimensions.width * 3);
  expect(selectedWidth).toBeLessThanOrEqual(2048);
  expect(dimensions.width / dimensions.height).toBeCloseTo(16 / 7, 1);
  expect(requests.filter((url) => url.includes('fixture-cover'))).toHaveLength(1);
  for (const width of [320, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => banner.evaluate((node: HTMLImageElement) => Number.parseInt(node.sizes) === Math.ceil(node.getBoundingClientRect().width))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Test Genshin announcement', exact: true })).toBeVisible();
  }
  await context.close();
});

test('article originals and provided srcsets take priority over the same cover thumbnail', async ({ page }) => {
  const thumbnail = 'https://images.test/thumbnail.jpg';
  const original = 'https://images.test/original.jpg';
  const requests = await mockHome(page, { image: thumbnail, content_html: `<img src="${thumbnail}" data-original="${original}" srcset="https://images.test/cover-640.jpg 640w, https://images.test/cover-1280.jpg 1280w"><img src="https://images.test/unrelated-large.jpg">` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const banner = page.locator('.news-banner-image img');
  await expect(banner).toHaveAttribute('src', original);
  await expect(banner).toHaveAttribute('srcset', /cover-640.*cover-1280/);
  await expect.poll(() => banner.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  expect(requests.some((url) => url.includes('thumbnail') || url.includes('unrelated-large'))).toBe(false);
});

test('failed CDN transforms fall back to the original image without changing the article', async ({ page }) => {
  const requests = await mockHome(page, { image: upload }, (url) => url.includes('x-oss-process'));
  await page.goto('/');
  const banner = page.locator('.news-banner-image img');
  await expect(banner).toHaveAttribute('src', upload);
  await expect.poll(() => banner.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Test Genshin announcement', exact: true })).toBeVisible();
  expect(requests.filter((url) => url.includes('fixture-cover'))).toHaveLength(2);
});

test('all failed images stop requesting, skip article dividers, and leave readable news', async ({ page }) => {
  const requests = await mockHome(page, { image: upload, content_html: `<img no-preview="true" src="https://hyl-static-res-prod.hoyolab.com/divider_config/PC/line.png"><img src="https://images.test/backup.jpg">` }, () => true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Test Genshin announcement', exact: true })).toBeVisible();
  await expect(page.locator('.news-banner-image img')).toHaveCount(0);
  expect(requests.some((url) => url.includes('divider_config'))).toBe(false);
  const count = requests.length;
  await page.waitForTimeout(500);
  expect(requests).toHaveLength(count);
  expect(requests.filter((url) => url.includes('fixture-cover') || url.includes('backup'))).toHaveLength(3);
});
