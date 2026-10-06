import { expect, test, type Page } from '@playwright/test';

const characters = [
  { id: 10000002, name: 'Kamisato Ayaka', rarity: 5, element: 'Cryo', weapontype: 'Sword', region: 'Inazuma', images: { filename_icon: 'UI_AvatarIcon_Ayaka', filename_iconCard: 'UI_AvatarIcon_Ayaka_Card' } },
  { id: 10000003, name: 'Jean', rarity: 5, element: 'Anemo', weapontype: 'Sword', region: 'Mondstadt', images: { filename_icon: 'UI_AvatarIcon_Qin', filename_iconCard: 'UI_AvatarIcon_Qin_Card' } },
  { id: 10000034, name: 'Noelle', rarity: 4, element: 'Geo', weapontype: 'Claymore', region: 'Mondstadt', images: { filename_icon: 'UI_AvatarIcon_Noel', filename_iconCard: 'UI_AvatarIcon_Noel_Card' } },
  { id: 10000100, name: 'A Character With A Longer Display Name', rarity: 5, element: 'Hydro', weapontype: 'Catalyst', region: 'Nod-Krai', images: { filename_icon: 'UI_AvatarIcon_Test', filename_iconCard: 'UI_AvatarIcon_Test_Card' } },
];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="700"><defs><linearGradient id="g"><stop stop-color="#214d68"/><stop offset="1" stop-color="#0c192b"/></linearGradient></defs><rect width="1600" height="700" fill="url(#g)"/><path d="M800 170l60 120 130 20-95 95 25 135-120-65-120 65 25-135-95-95 130-20z" fill="#d9bd7d"/></svg>';
const news = [
  { title: 'Your next adventure awaits in Teyvat', url: 'https://www.hoyolab.com/article/first', image: 'https://images.test/first.jpg', date_published: '2026-10-06T00:00:00Z' },
  { title: 'A much longer announcement title with details about an upcoming adventure and the places travelers can explore together', url: 'https://www.hoyolab.com/article/second', image: 'https://images.test/second.jpg', date_published: '2026-10-06T00:00:00Z' },
];
async function mock(page: Page) {
  const requests: string[] = [];
  await page.route('**/*', (route) => {
    const request = route.request(), url = request.url();
    if (url.startsWith('http://127.0.0.1:4173')) return route.continue();
    requests.push(url);
    if (request.resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: svg });
    if (url.includes('feeds.c3kay.de')) return route.fulfill({ json: { items: news } });
    if (url.includes('genshin-db-api')) {
      const parsed = new URL(url), folder = parsed.pathname.split('/').at(-1), query = parsed.searchParams.get('query');
      if (folder === 'characters') return route.fulfill({ json: query === 'names' ? characters : characters.find((entry) => entry.name === query) ?? characters[0] });
      if (folder === 'weapons' || folder === 'artifacts') return route.fulfill({ json: [{ id: 1, name: folder === 'weapons' ? 'Practice Sword' : 'Practice Set', rarity: 4, images: { filename_icon: 'UI_EquipIcon_Sword_Test' } }, { id: 2, name: 'An Item With A Longer Display Name', rarity: 5, images: { filename_icon: 'UI_EquipIcon_Sword_Test2' } }] });
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ status: 404 });
  });
  return requests;
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('main').evaluate((node) => node.getBoundingClientRect().right <= innerWidth + 1)).toBe(true);
  const escaped = await page.locator('.page .button, .page .source-button, .page input, .page select').evaluateAll((nodes) => nodes.filter((node) => {
    if (node.closest('.tabs, .player-tabs, .connected-build-tabs, .stat-table-wrap')) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
  }).map((node) => node.outerHTML.slice(0, 200)));
  expect(escaped).toEqual([]);
}
async function samePeerSizes(page: Page, selector: string) {
  const sizes = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; }));
  expect(sizes.length).toBeGreaterThan(1);
  for (const card of sizes) {
    const peers = sizes.filter((entry) => Math.abs(entry.y - card.y) < 1);
    expect(Math.max(...peers.map((entry) => entry.width)) - Math.min(...peers.map((entry) => entry.width))).toBeLessThan(1.1);
    expect(Math.max(...peers.map((entry) => entry.height)) - Math.min(...peers.map((entry) => entry.height))).toBeLessThan(1.1);
  }
}

test('team saves compact roles with the corresponding characters after earlier and middle slots are removed', async ({ page }) => {
  await mock(page);
  await page.goto('/teams');
  await page.getByRole('button', { name: /Sword.*Kamisato Ayaka/ }).click();
  await page.getByRole('button', { name: /Sword.*Jean/ }).click();
  await page.getByRole('button', { name: /Claymore.*Noelle/ }).click();
  await page.getByRole('combobox', { name: 'Kamisato Ayaka role', exact: true }).selectOption('On-field DPS');
  await page.getByRole('combobox', { name: 'Jean role', exact: true }).selectOption('Healer');
  await page.getByRole('combobox', { name: 'Noelle role', exact: true }).selectOption('Shielder');
  await page.getByRole('button', { name: 'Remove Kamisato Ayaka', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('Gap test');
  await page.getByRole('button', { name: 'Save team', exact: true }).click();
  const saved = page.locator('.saved-team').filter({ has: page.getByRole('heading', { name: 'Gap test', exact: true }) });
  await expect(saved.locator('.member-pill').nth(0)).toContainText('Jean');
  await expect(saved.locator('.member-pill').nth(0)).toContainText('Healer');
  await expect(saved.locator('.member-pill').nth(1)).toContainText('Noelle');
  await expect(saved.locator('.member-pill').nth(1)).toContainText('Shielder');
  await page.getByRole('button', { name: /Sword.*Kamisato Ayaka/ }).click();
  await page.getByRole('combobox', { name: 'Kamisato Ayaka role', exact: true }).selectOption('On-field DPS');
  await page.getByRole('button', { name: 'Remove Jean', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('Middle gap');
  await page.getByRole('button', { name: 'Save team', exact: true }).click();
  const snapshots = await page.evaluate(() => JSON.parse(localStorage.getItem('teyvat-atlas:teams') ?? '[]'));
  expect(snapshots[0].roles).toEqual(['On-field DPS', 'Shielder']);
  expect(snapshots[1].roles).toEqual(['Healer', 'Shielder']);
  expect(snapshots.every((entry: any) => entry.members.length === entry.roles.length)).toBe(true);
  await page.reload();
  const restored = page.locator('.saved-team').filter({ has: page.getByRole('heading', { name: 'Gap test', exact: true }) });
  await expect(restored.locator('.member-pill').nth(0)).toContainText('Healer');
});

test('Home keeps peer cards and action baselines aligned across phones, tablets and desktops', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await mock(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: news[0].title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause news rotation', exact: true }).click();
  for (const width of [320, 390, 640, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
    await samePeerSizes(page, '.home-tools .feature-card');
    await samePeerSizes(page, '.home-quick-card');
    const actions = await page.locator('.home-tools .feature-card > span').evaluateAll((nodes) => nodes.map((node) => ({ y: node.parentElement!.getBoundingClientRect().y, bottom: node.getBoundingClientRect().bottom })));
    for (const item of actions) expect(Math.max(...actions.filter((entry) => Math.abs(entry.y - item.y) < 1).map((entry) => entry.bottom)) - item.bottom).toBeLessThan(1.1);
    const heights = await page.locator('.home-hero .hero-actions .button').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1.1);
    if (width === 390 || width === 1366) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
  await expect(page.locator('.home-quick-grid').getByRole('link', { name: /My Profile/ })).toHaveAttribute('href', '/me');
});

test('news navigation pauses while reading, honors reduced motion, and does not trigger new feed requests', async ({ page }) => {
  const requests = await mock(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: news[0].title, exact: true })).toBeVisible();
  await page.clock.install();
  await page.getByRole('button', { name: 'Next news', exact: true }).click();
  await expect(page.getByRole('heading', { name: news[1].title, exact: true })).toBeVisible();
  await page.clock.fastForward(18000);
  await expect(page.getByRole('heading', { name: news[1].title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous news', exact: true }).click();
  await expect(page.getByRole('heading', { name: news[0].title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume news rotation', exact: true }).click();
  await page.locator('.home-tools-jump').focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(6500);
  await expect(page.getByRole('heading', { name: news[1].title, exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.clock.fastForward(18000);
  await expect(page.getByRole('heading', { name: news[1].title, exact: true })).toBeVisible();
  expect(requests.filter((url) => url.includes('feeds.c3kay.de'))).toHaveLength(1);
});

test('news loading, errors and recovered articles reserve identical space without hiding player tools', async ({ page }) => {
  await mock(page);
  let release: (() => void) | undefined;
  await page.route('https://feeds.c3kay.de/genshin.json', async (route) => { await new Promise<void>((resolve) => { release = resolve; }); return route.fulfill({ json: { items: [] } }); });
  await page.goto('/');
  await expect(page.locator('.home-news-state')).toContainText('Loading Genshin news');
  const height = await page.locator('.home-news').evaluate((node) => node.getBoundingClientRect().height);
  await expect.poll(() => Boolean(release)).toBe(true); release?.();
  await expect(page.getByRole('button', { name: 'Retry news', exact: true })).toBeVisible();
  expect(await page.locator('.home-news').evaluate((node) => node.getBoundingClientRect().height)).toBeCloseTo(height, 1);
  await page.route('https://feeds.c3kay.de/genshin.json', (route) => route.fulfill({ json: { items: [{ title: 'Unsafe link', url: 'javascript:alert(1)' }, ...news] } }));
  await page.getByRole('button', { name: 'Retry news', exact: true }).click();
  await expect(page.getByRole('heading', { name: news[0].title, exact: true })).toBeVisible();
  expect(await page.locator('.home-news').evaluate((node) => node.getBoundingClientRect().height)).toBeCloseTo(height, 1);
  await expect(page.getByRole('heading', { name: 'Unsafe link', exact: true })).toHaveCount(0);
  await expect(page.locator('.home-tools .feature-card')).toHaveCount(4);
});

test('shared page layouts keep cards and controls usable at mobile and desktop widths', async ({ page }, testInfo) => {
  await mock(page);
  for (const route of ['/characters', '/weapons', '/artifacts', '/teams', '/materials', '/compare', '/guides', '/sources', '/account', '/profile', '/map']) {
    await page.goto(route);
    await expect(page.locator('main .section-title').first()).toBeVisible();
    for (const width of [320, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      await noOverflow(page);
    }
    for (const selector of ['.character-grid .character-card', '.entity-grid .entity-card', '.source-grid .source-card', '.compare-grid .compare-column', '.team-insight-grid article']) {
      if (await page.locator(selector).count() > 1) await samePeerSizes(page, selector);
    }
    if (['/characters', '/teams', '/compare', '/guides'].includes(route)) await page.screenshot({ path: testInfo.outputPath(`page-${route.slice(1)}.png`), fullPage: true });
  }
});

test('loaded comparisons share attribute rows without truncating long names and swapping preserves selections', async ({ page }, testInfo) => {
  await mock(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/compare');
  await page.getByRole('combobox', { name: 'Left character', exact: true }).selectOption({ label: 'Jean' });
  await page.getByRole('combobox', { name: 'Right character', exact: true }).selectOption({ label: characters[3].name });
  await expect(page.locator('.compare-column').nth(0).getByRole('heading', { name: 'Jean', exact: true })).toBeVisible();
  await expect(page.locator('.compare-column').nth(1).getByRole('heading', { name: characters[3].name, exact: true })).toBeVisible();
  const positions = await page.locator('.compare-column').evaluateAll((nodes) => nodes.map((node) => Array.from(node.querySelectorAll('.compare-stat-grid, .compare-section')).map((row) => row.getBoundingClientRect().y)));
  expect(positions[0]).toHaveLength(5);
  expect(positions[1]).toHaveLength(5);
  for (let index = 0; index < positions[0].length; index++) expect(Math.abs(positions[0][index] - positions[1][index])).toBeLessThan(1.1);
  await samePeerSizes(page, '.compare-grid .compare-column');
  await page.screenshot({ path: testInfo.outputPath('comparison-loaded-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Swap comparison characters', exact: true }).click();
  await expect(page.locator('.compare-column').nth(0).getByRole('heading', { name: characters[3].name, exact: true })).toBeVisible();
  await expect(page.locator('.compare-column').nth(1).getByRole('heading', { name: 'Jean', exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1366]) { await page.setViewportSize({ width, height: 844 }); await noOverflow(page); }
});
