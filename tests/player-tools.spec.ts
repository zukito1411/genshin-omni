import { expect, test, type Page } from '@playwright/test';
import type { EnkaProfile } from '../src/types/enka';

const artifactSlots = ['flower', 'plume', 'sands', 'goblet', 'circlet'];
const artifactIcons = [4, 2, 5, 1, 3].map((slot) => `UI_RelicIcon_14001_${slot}`);
const artifactPieceNames = ['Snowswept Memory', "Icebreaker's Resolve", "Frozen Homeland's Demise", 'Frost-Weaved Dignity', "Broken Rime's Echo"];
const artifactSet = {
  id: 14001, name: 'Blizzard Strayer', rarityList: [4, 5], effect2Pc: 'Cryo DMG Bonus +15%', effect4Pc: 'CRIT Rate increases against Frozen opponents.',
  ...Object.fromEntries(artifactSlots.map((slot, index) => [slot, { name: artifactPieceNames[index], relicType: ['EQUIP_BRACER', 'EQUIP_NECKLACE', 'EQUIP_SHOES', 'EQUIP_RING', 'EQUIP_DRESS'][index] }])),
  images: Object.fromEntries(artifactSlots.map((slot, index) => [`filename_${slot}`, artifactIcons[index]])),
};
const weapon = { id: 11509, name: 'Mistsplitter Reforged', rarity: 5, weaponText: 'Sword', images: { filename_icon: 'UI_EquipIcon_Sword_Narukami' }, r1: { description: 'Gain an Elemental DMG Bonus.' }, costs: { ascension1: [{ name: 'Mora', count: 10000 }] } };
const characterData = { name: 'Kamisato Ayaka', id: 10000002, element: 'Cryo', weapontype: 'Sword', rarity: 5, images: { filename_icon: 'UI_AvatarIcon_Ayaka', filename_gachaSplash: 'UI_Gacha_AvatarImg_Ayaka' }, costs: { ascension1: [{ name: 'Mora', count: 20000 }, { name: 'Sakura Bloom', count: 3 }] } };
const fixtureImage = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100"><defs><linearGradient id="g"><stop stop-color="#426d8c"/><stop offset="1" stop-color="#182739"/></linearGradient></defs><rect width="180" height="100" fill="url(#g)"/><path d="M90 22l12 23 26 5-19 18 4 26-23-12-23 12 4-26-19-18 26-5z" fill="#e8c77d"/></svg>';

const avatar = {
  avatarId: 10000002, skillDepotId: 201, propMap: { '4001': { val: '90' }, '1001': { val: '12345' }, '1002': { val: '6' } },
  talentIdList: [21, 22, 23], fetterInfo: { expLevel: 10 },
  fightPropMap: { '2000': 20000, '2001': 2100, '2002': 900, '20': 0.455, '22': 2.1, '23': 1.3, '28': 40, '46': 0.466, '81': 0.35 },
  skillLevelMap: { '10024': 10, '10018': 10, '10019': 10 }, proudSkillExtraLevelMap: { '232': 3 },
  equipList: [
    { itemId: 11509, weapon: { level: 90, affixMap: { '111509': 0 } }, flat: { icon: 'UI_EquipIcon_Sword_Narukami', itemType: 'ITEM_WEAPON', nameTextMapHash: '100', rankLevel: 5, weaponStats: [{ appendPropId: 'FIGHT_PROP_BASE_ATTACK', statValue: 674 }, { appendPropId: 'FIGHT_PROP_CRITICAL_HURT', statValue: 44.1 }] } },
    ...['EQUIP_BRACER', 'EQUIP_NECKLACE', 'EQUIP_SHOES', 'EQUIP_RING', 'EQUIP_DRESS'].map((slot, index) => ({ itemId: 7000 + index, reliquary: { level: 21 }, flat: { icon: artifactIcons[index], itemType: 'ITEM_RELIQUARY', equipType: slot, rankLevel: 5, nameTextMapHash: '101', setNameTextMapHash: '102', reliquaryMainstat: { mainPropId: 'FIGHT_PROP_ATTACK_PERCENT', statValue: 46.6 }, reliquarySubstats: [{ appendPropId: 'FIGHT_PROP_CRITICAL', statValue: 10.1 }, { appendPropId: 'FIGHT_PROP_CRITICAL_HURT', statValue: 20.2 }] } })),
  ],
};
const profile = { playerInfo: { nickname: 'Test Traveler', signature: 'Public showcase', level: 60, worldLevel: 9, finishAchievementNum: 1200, towerFloorIndex: 12, towerLevelIndex: 3, nameCardId: 210001, profilePicture: { avatarId: 10000002 }, showNameCardIdList: [210001] }, avatarInfoList: [avatar] };

async function mockSources(page: Page, options: { hidden?: boolean; directFailure?: boolean; metadataFailure?: boolean; imageFailover?: boolean; imagesUnavailable?: boolean } = {}) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:4173/')) return route.continue();
    if (url.includes('/api/uid/')) {
      const payload = options.hidden ? { playerInfo: profile.playerInfo } : profile;
      if (url.includes('r.jina.ai/')) return route.fulfill({ json: { data: { content: JSON.stringify(payload) } } });
      return options.directFailure ? route.fulfill({ status: 403 }) : route.fulfill({ json: payload });
    }
    if (url.endsWith('/characters.json') || url.endsWith('/avatars.json')) {
      return options.metadataFailure ? route.fulfill({ status: 403 }) : route.fulfill({ json: { '10000002': { NameTextMapHash: 1, SideIconName: 'UI_AvatarIcon_Side_Ayaka', Element: 'Ice', QualityType: 'QUALITY_ORANGE', SkillOrder: [10024, 10018, 10019], Skills: { '10024': 'Skill_A_01', '10018': 'Skill_S_Ayaka_01', '10019': 'Skill_E_Ayaka_HD' }, Consts: Array.from({ length: 6 }, (_, index) => `UI_Talent_S_Ayaka_0${index + 1}`), ProudMap: { '10018': 232 } } } });
    }
    if (url.endsWith('/loc.json') || url.endsWith('/locs.json')) return route.fulfill({ json: { en: { '1': 'Kamisato Ayaka', '100': 'Mistsplitter Reforged', '101': 'Frozen Homeland', '102': 'Blizzard Strayer' } } });
    if (url.endsWith('/weapons.json')) return route.fulfill({ json: { '11509': { NameTextMapHash: 100, Rarity: 5, Icon: '/ui/UI_EquipIcon_Sword_Narukami.png', BaseProps: { '4': 47.537, '22': .096 }, PropGrowCurves: { '4': 1302, '22': 2301 }, BasePromote: [0, 31.1, 62.2, 93.4, 124.5, 155.6, 186.7] } } });
    if (url.endsWith('/curves.json')) return route.fulfill({ json: { '1302': Array.from({ length: 90 }, () => 10.258), '2301': Array.from({ length: 90 }, () => 4.594) } });
    if (url.endsWith('/relics.json')) return route.fulfill({ json: { Items: { '7000': { Rarity: 5, EquipType: 0, SetId: 14001, Icon: '/ui/UI_RelicIcon_14001_4.png' } }, Sets: { '14001': { Name: '102' } } } });
    if (url.endsWith('/relic_levels.json')) return route.fulfill({ json: { '5': { '21': { '6': .466, '2': 4780 } } } });
    if (url.endsWith('/affixes.json')) return route.fulfill({ json: { '501204': { PropType: 20, Value: .0389 }, '501224': { PropType: 22, Value: .0777 } } });
    if (url.endsWith('/namecards.json')) return route.fulfill({ json: { '210001': { icon: 'UI_NameCardPic_Ayaka_P' } } });
    if (url.endsWith('/pfps.json')) return route.fulfill({ json: {} });
    if (/\/(?:UI_|Skill_)[\w-]+\.(?:png|webp)(?:\?|$)/.test(url)) {
      if (options.imagesUnavailable || (options.imageFailover && (url.includes('enka.network') || url.includes('raw.githubusercontent.com')))) return route.fulfill({ status: 404 });
      return route.fulfill({ contentType: 'image/svg+xml', body: fixtureImage });
    }
    if (url.includes('genshin-db-api')) {
      const parsed = new URL(url);
      const folder = parsed.pathname.split('/').at(-1);
      const query = parsed.searchParams.get('query');
      if (folder === 'characters') return route.fulfill({ json: query === 'names' ? [characterData] : characterData });
      if (folder === 'weapons') return route.fulfill({ json: query === 'names' ? [weapon] : weapon });
      if (folder === 'artifacts') return route.fulfill({ json: query === 'names' ? [artifactSet] : artifactSet });
      if (folder === 'materials') return route.fulfill({ json: { name: query, images: { filename_icon: query === 'Mora' ? 'UI_ItemIcon_202' : 'UI_ItemIcon_101202' } } });
      if (folder === 'stats') return route.fulfill({ json: { '90': { hp: 12858, attack: 342, defense: 784 } } });
      if (folder === 'talents') return route.fulfill({ json: { combat1: { name: 'Kamisato Art: Kabuki', description: 'Performs rapid strikes.' }, images: { filename_combat1: 'Skill_A_01' } } });
      if (folder === 'constellations') return route.fulfill({ json: { c1: { name: 'Snowswept Sakura', description: 'Cryo hits can reduce the skill cooldown.' }, images: { filename_c1: 'UI_Talent_S_Ayaka_01' } } });
    }
    if (url.includes('r.jina.ai/https://genshin-builds.com/en/')) return route.fulfill({ body: '' });
    if (url.includes('genshin.jmp.blue/characters/kamisato-ayaka?')) return route.fulfill({ json: { name: characterData.name, ascension_materials: [{ name: 'Mora', value: 20000 }, { name: 'Sakura Bloom', value: 3 }] } });
    return route.fulfill({ status: 404 });
  });
}

test('UID search opens equipped builds with correct values and supports deep-link refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockSources(page);
  await page.goto('/account');
  await expect(page.locator('#profile-uid')).toHaveCount(0);
  await page.getByRole('link', { name: 'Open UID Search' }).click();
  await page.getByLabel('Genshin UID').fill('123');
  await page.getByRole('button', { name: 'Search UID' }).click();
  await expect(page.getByRole('alert')).toContainText('9 or 10 digits');
  await page.getByLabel('Genshin UID').fill('800000001');
  await page.getByRole('button', { name: 'Search UID' }).click();
  const character = page.locator('.showcase-card--link');
  await expect(character).toContainText('Kamisato Ayaka');
  await expect(character).toContainText('Level 90');
  await page.getByRole('button', { name: 'Add showcase to My Roster' }).click();
  await expect(page.getByRole('status')).toContainText('1 showcase character added');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('teyvat-atlas:owned-characters:v1') ?? '[]'))).toContain('10000002');
  await character.click();
  await expect(page).toHaveURL(/\/profile\/800000001\/characters\/10000002-201$/);
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged' })).toBeVisible();
  await expect(page.locator('.equipped-item').first()).toContainText('R1');
  await expect(page.locator('.showcase-stats').first()).toContainText('45.5%');
  await page.getByText('Damage bonuses, resistances, and other attributes', { exact: true }).click();
  await expect(page.locator('.showcase-additional-stats')).toContainText('35%');
  await expect(page.locator('.equipped-artifact-grid .equipped-item')).toHaveCount(5);
  await expect(page.locator('.equipped-artifact-grid').first()).toContainText('+20');
  await expect(page.locator('.equipped-artifact-grid').first()).toContainText('46.6%');
  await expect(page.locator('.showcase-talents')).toContainText('Level 13');
  await expect(page.locator('.showcase-constellations .unlocked')).toHaveCount(3);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Kamisato Ayaka', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to profile' }).click();
  await expect(character).toBeVisible();
  expect(errors).toEqual([]);
});

test('reader fallback and hidden builds remain usable', async ({ page }) => {
  await mockSources(page, { directFailure: true, hidden: true });
  await page.goto('/profile/800000001');
  await expect(page.getByRole('heading', { name: 'Test Traveler' })).toBeVisible();
  await expect(page.locator('.empty-state')).toContainText('no public character build details');
  await expect(page.locator('.showcase-card--link')).toHaveCount(0);
  await page.goto('/profile/800000001/characters/10000002-201');
  await expect(page.locator('.empty-state')).toContainText('no longer in the public showcase');
});

test('current metadata resolves character variants, relative artwork, and abbreviated equipment', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockSources(page);
  const current: EnkaProfile = structuredClone(profile);
  const build = current.avatarInfoList![0];
  build.avatarId = 10000117;
  build.skillDepotId = 11703;
  build.equipList = [
    { itemId: 11509, weapon: { level: 90, promoteLevel: 6, affixMap: { '111509': 0 } }, flat: { icon: 'UI_EquipIcon_Sword_Narukami', itemType: 'ITEM_WEAPON', weaponStats: [{ appendPropId: 'FIGHT_PROP_BASE_ATTACK' }, { appendPropId: 'FIGHT_PROP_CRITICAL_HURT' }] } },
    { itemId: 7000, reliquary: { level: 21, appendPropIdList: [501204, 501204, 501224] }, flat: { icon: 'UI_RelicIcon_14001_4', itemType: 'ITEM_RELIQUARY', reliquaryMainstat: { mainPropId: 'FIGHT_PROP_ATTACK_PERCENT' }, reliquarySubstats: [{ appendPropId: 'FIGHT_PROP_CRITICAL' }, { appendPropId: 'FIGHT_PROP_CRITICAL_HURT' }] } },
  ];
  await page.route('**/api/uid/**', (route) => route.fulfill({ json: current }));
  await page.route('**/gi/avatars.json', (route) => route.fulfill({ json: { '10000117-11703': { NameTextMapHash: 1, SideIconName: '/ui/UI_AvatarIcon_Side_Ayaka.png', SkillOrder: [10024, 10018, 10019], Skills: { '10024': '/ui/Skill_A_01.png' }, Costumes: { '200201': { Icon: '/ui/UI_AvatarIcon_AyakaCostumeFruhling.png', Art: '/ui/UI_Costume_AyakaCostumeFruhling.png' } } } } }));
  await page.route('**/characters.json', (route) => route.fulfill({ status: 403 }));
  await page.goto('/profile/800000001');
  await expect(page.locator('.showcase-card--link')).toContainText('Kamisato Ayaka');
  await page.locator('.showcase-card--link').click();
  await expect(page).toHaveURL(/10000117-11703$/);
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged' })).toBeVisible();
  const equipped = page.locator('.equipped-item').first();
  await expect(equipped.locator('.build-stat-list')).toContainText('674');
  await expect(equipped.locator('.build-stat-list')).toContainText('44.1%');
  const artifact = page.locator('.equipped-artifact-grid .equipped-item').first();
  await expect(artifact).toContainText('Snowswept Memory');
  await expect(artifact).toContainText('46.6%');
  await expect(artifact).toContainText('7.8%');
  await expect(page.locator('img.showcase-build-hero__image')).toHaveAttribute('src', /UI_Gacha_AvatarImg_Ayaka\.png/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('legacy equipment field aliases remain readable without applying percentage scaling twice', async ({ page }) => {
  await mockSources(page);
  const legacy: EnkaProfile = structuredClone(profile);
  for (const item of legacy.avatarInfoList![0].equipList!) {
    const flat = item.flat!;
    flat.nameTextHashMap = flat.nameTextMapHash;
    flat.setNameTextHashMap = flat.setNameTextMapHash;
    delete flat.nameTextMapHash;
    delete flat.setNameTextMapHash;
    for (const stat of [...flat.weaponStats ?? [], ...flat.reliquarySubstats ?? [], ...flat.reliquaryMainstat ? [flat.reliquaryMainstat] : []]) {
      stat.propValue = stat.statValue;
      delete stat.statValue;
      stat.appendPropID = stat.appendPropId;
      delete stat.appendPropId;
    }
  }
  await page.route('**/api/uid/**', (route) => route.fulfill({ json: legacy }));
  await page.goto('/profile/800000001/characters/10000002-201');
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged' })).toBeVisible();
  await expect(page.locator('.equipped-item').first()).toContainText('44.1%');
  await expect(page.locator('.equipped-artifact-grid .equipped-item').first()).toContainText('46.6%');
  await expect(page.locator('.equipped-artifact-grid .equipped-item').first()).toContainText('10.1%');
});

test('searching the same UID refreshes previously cached metadata and equipment', async ({ page }) => {
  await mockSources(page);
  await page.goto('/profile/800000001');
  await expect(page.locator('.showcase-card--link')).toContainText('Kamisato Ayaka');
  await page.route('**/gi/locs.json', (route) => route.fulfill({ json: { en: { '1': 'Updated character name', '100': 'Mistsplitter Reforged' } } }));
  await page.getByRole('button', { name: 'Search UID' }).click();
  await expect(page.locator('.showcase-card--link')).toContainText('Updated character name');
});

test('all five artifact pieces resolve by exact icons without localized name hashes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockSources(page);
  const abbreviated: EnkaProfile = structuredClone(profile);
  for (const item of abbreviated.avatarInfoList![0].equipList!.filter((item) => item.reliquary)) {
    delete item.flat!.nameTextMapHash;
    delete item.flat!.setNameTextMapHash;
  }
  await page.route('**/api/uid/**', (route) => route.fulfill({ json: abbreviated }));
  await page.goto('/profile/800000001/characters/10000002-201');
  const cards = page.locator('.equipped-artifact-grid .equipped-item');
  await expect(cards).toHaveCount(5);
  for (let index = 0; index < artifactPieceNames.length; index++) {
    await expect(cards.nth(index).getByRole('heading')).toHaveText(artifactPieceNames[index]);
    await expect(cards.nth(index).locator('.equipped-item__set')).toHaveText('Blizzard Strayer');
    await expect(cards.nth(index)).toContainText('46.6%');
  }
  await expect(page.locator('.artifact-set-summary')).toContainText('Blizzard Strayer · 5 pieces');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Snowswept Memory' })).toBeVisible();
});

test('artifact names survive a catalog outage and mixed sets stay distinct', async ({ page }) => {
  await mockSources(page);
  const mixed: EnkaProfile = structuredClone(profile);
  const artifacts = mixed.avatarInfoList![0].equipList!.filter((item) => item.reliquary);
  for (const item of artifacts) {
    delete item.flat!.nameTextMapHash;
    delete item.flat!.setNameTextMapHash;
  }
  artifacts[4].flat!.icon = '/ui/UI_RelicIcon_15002_3.png';
  await page.route('**/api/uid/**', (route) => route.fulfill({ json: mixed }));
  await page.route('**/api/v5/artifacts?**', (route) => route.fulfill({ status: 403 }));
  await page.goto('/profile/800000001/characters/10000002-201');
  await expect(page.getByRole('heading', { name: 'Snowswept Memory' })).toBeVisible();
  await expect(page.locator('.equipped-artifact-grid .equipped-item').last().locator('.equipped-item__set')).toHaveText('Viridescent Venerer');
  await expect(page.locator('.artifact-set-summary')).toContainText('Blizzard Strayer · 4 pieces');
  await expect(page.locator('.artifact-set-summary')).toContainText('Viridescent Venerer · 1 piece');
  await expect(page.locator('.equipped-artifact-grid')).not.toContainText('unavailable');
});

test('unknown artifact rolls never become misleading partial substat totals', async ({ page }) => {
  await mockSources(page);
  const incomplete: EnkaProfile = structuredClone(profile);
  incomplete.avatarInfoList![0].equipList = [{ itemId: 7000, reliquary: { level: 21, appendPropIdList: [501204, 999999] }, flat: { equipType: 'EQUIP_BRACER', itemType: 'ITEM_RELIQUARY', reliquaryMainstat: { mainPropId: 'FIGHT_PROP_HP' } } }];
  await page.route('**/api/uid/**', (route) => route.fulfill({ json: incomplete }));
  await page.goto('/profile/800000001/characters/10000002-201');
  const artifact = page.locator('.equipped-artifact-grid .equipped-item').first();
  await expect(artifact).toContainText('4,780');
  await expect(artifact).not.toContainText('3.9%');
});

test('mobile builds fit narrow screens and stats work when metadata is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockSources(page, { metadataFailure: true });
  await page.goto('/profile/800000001/characters/10000002-201');
  await expect(page.locator('.showcase-stats').first()).toContainText('45.5%');
  await expect(page.locator('.equipped-artifact-grid .equipped-item')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Character name unavailable', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weapon name unavailable', exact: true })).toBeVisible();
  await expect(page.locator('.equipped-artifact-grid .equipped-item').first()).toContainText('Snowswept Memory');
  await expect(page.locator('.showcase-talents')).toContainText('Shared talent');
  expect(await page.locator('body').innerText()).not.toMatch(/\b(?:Character|Item|Weapon|Artifact|Set|Talent)\s+\d{3,}\b/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('unknown IDs never appear as character, equipment, set, or talent labels', async ({ page }) => {
  await mockSources(page);
  const unknown: EnkaProfile = structuredClone(profile);
  const build = unknown.avatarInfoList![0];
  build.avatarId = 99887766;
  build.skillLevelMap = { '88776655': 10 };
  build.equipList = [
    { itemId: 887766, weapon: { level: 90 }, flat: { nameTextMapHash: 88776655, weaponStats: [{ appendPropId: 'FIGHT_PROP_BASE_ATTACK', statValue: 674 }] } },
    { itemId: 776655, reliquary: { level: 21 }, flat: { equipType: 'EQUIP_BRACER', nameTextMapHash: 77665544, setNameTextMapHash: 66554433, reliquaryMainstat: { mainPropId: 'FIGHT_PROP_NEW_99999', statValue: 12 } } },
  ];
  await page.route('**/api/uid/**', (route) => route.fulfill({ json: unknown }));
  await page.goto('/profile/800000001');
  const link = page.locator('.showcase-card--link');
  await expect(link).toContainText('Character name unavailable');
  await expect(link).not.toContainText('99887766');
  await link.click();
  await expect(page.getByRole('heading', { name: 'Weapon name unavailable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flower name unavailable' })).toBeVisible();
  await expect(page.locator('.artifact-set-summary')).toContainText('Set name unavailable');
  await expect(page.locator('.showcase-talents')).toContainText('Shared talent');
  await expect(page.locator('.equipped-artifact-grid')).toContainText('Other attribute');
  expect(await page.locator('body').innerText()).not.toMatch(/\b(?:Character|Item|Weapon|Artifact|Set|Talent)\s+\d{3,}\b/i);
  expect(await page.locator('body').innerText()).not.toMatch(/99887766|88776655|77665544|66554433|NEW_99999/);
});

test('blank or numeric localization entries cannot masquerade as display names', async ({ page }) => {
  await mockSources(page);
  await page.route('**/gi/locs.json', (route) => route.fulfill({ json: { en: { '1': '10000002', '100': '11509', '101': '   ', '102': '14001' } } }));
  await page.goto('/profile/800000001/characters/10000002-201');
  await expect(page.getByRole('heading', { name: 'Character name unavailable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weapon name unavailable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Snowswept Memory' })).toBeVisible();
  await expect(page.locator('.equipped-item').first()).toContainText('674');
  await expect(page.locator('.equipped-item').first()).toContainText('44.1%');
});

test('mobile bubble taps, drags, docks, and persists without opening on drag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSources(page);
  await page.goto('/profile');
  const bubble = page.locator('.paimon-launcher');
  await expect(bubble).toBeVisible();
  const before = await bubble.boundingBox();
  expect(before!.x).toBeCloseTo(361, 0);
  // Exercise the real pointer handlers: a held mouse pointer uses the same
  // pointer capture path as touch, while the mobile viewport activates docking.
  await page.mouse.move(380, before!.y + 25);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await page.mouse.move(35, 280, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('#paimon-helper')).toHaveCount(0);
  await expect(bubble).not.toHaveClass(/dragging/);
  await expect.poll(async () => (await bubble.boundingBox())!.x).toBe(-29);
  await page.reload();
  await expect.poll(async () => (await bubble.boundingBox())!.x).toBe(-29);
  const docked = (await bubble.boundingBox())!;
  await page.mouse.click(12, docked.y + 25);
  await expect(page.locator('#paimon-helper')).toBeVisible();
  await page.getByRole('button', { name: 'Close Paimon helper' }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(bubble).not.toHaveClass(/mobile/);
  const desktop = (await bubble.boundingBox())!;
  expect(desktop.x).toBeGreaterThan(700);
  await page.setViewportSize({ width: 390, height: 600 });
  const rotated = (await bubble.boundingBox())!;
  expect(rotated.y + rotated.height).toBeLessThanOrEqual(600);
});

test('AI failures produce the native Paimon answer', async ({ page }) => {
  await mockSources(page);
  await page.route('**/api/paimon-chat', (route) => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Open Paimon helper' }).click();
  await page.getByRole('textbox', { name: 'Ask Paimon', exact: true }).fill('How are you?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('#paimon-helper small')).toContainText('Built-in Paimon');
  await expect(page.locator('#paimon-helper > p')).not.toContainText('thinking');
});

test('touch dragging docks on both edges, cancellation recovers, and a tap opens chat', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSources(page);
  await page.goto('/profile');
  const bubble = page.locator('.paimon-launcher');
  const session = await page.context().newCDPSession(page);
  const rect = (await bubble.boundingBox())!;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 380, y: rect.y + 25 }] });
  await page.waitForTimeout(350);
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 30, y: 230 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await bubble.boundingBox())!.x).toBe(-29);
  await expect(page.locator('#paimon-helper')).toHaveCount(0);
  let nextRect = (await bubble.boundingBox())!;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 10, y: nextRect.y + 25 }] });
  await page.waitForTimeout(350);
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 350, y: 400 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(bubble).not.toHaveClass(/dragging/);
  await expect.poll(async () => (await bubble.boundingBox())!.x).toBe(361);
  nextRect = (await bubble.boundingBox())!;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 380, y: nextRect.y + 25 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#paimon-helper')).toBeVisible();
});

test('complete mobile profile build has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockSources(page);
  await page.goto('/profile/800000001/characters/10000002-201');
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged' })).toBeVisible();
  for (const width of [320, 360, 390, 768]) {
    await page.setViewportSize({ width, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 740 });
  // Full-page capture does not itself trigger lazy images below the viewport.
  // Scroll stable containers: placeholders legitimately become decoded images.
  for (const card of await page.locator('.equipped-item, .showcase-talents, .showcase-constellations').all()) await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/profile-build-mobile.png', fullPage: true });
});

test('an AI request that never responds times out into the native guide', async ({ page }) => {
  await mockSources(page);
  await page.route('**/api/paimon-chat', () => { /* Deliberately pending. */ });
  await page.clock.install();
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Open Paimon helper' }).click();
  await page.getByRole('textbox', { name: 'Ask Paimon', exact: true }).fill('How are you?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('#paimon-helper > p')).toContainText('thinking');
  await page.clock.fastForward(18_100);
  await expect(page.locator('#paimon-helper small')).toContainText('Built-in Paimon');
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeEnabled();
});

test('profile artwork and public progress fit small phones and tablets', async ({ page }) => {
  await mockSources(page);
  await page.goto('/profile/800000001');
  const banner = page.locator('img.profile-banner__background');
  await expect(banner).toBeVisible();
  await expect.poll(() => banner.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('img.profile-avatar')).toBeVisible();
  await expect(page.locator('.profile-progress-card--achievements')).toContainText('1,200');
  await expect(page.locator('.profile-progress-grid')).toContainText('12–3');
  await expect(page.locator('.profile-namecards img')).toHaveCount(1);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('.profile-banner a')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/uid-overview-mobile.png', fullPage: true });
});

test('third image provider stays selected after unrelated rerenders', async ({ page }) => {
  await mockSources(page, { imageFailover: true });
  await page.goto('/profile/800000001/characters/10000002-201');
  await expect(page.getByRole('heading', { name: 'Kamisato Ayaka', exact: true })).toBeVisible();
  const illustration = page.locator('img.showcase-build-hero__image');
  await expect(illustration).toHaveAttribute('src', /gi\.yatta\.moe\/assets\/UI\/UI_Gacha_AvatarImg_Ayaka/);
  await expect.poll(() => illustration.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Open Paimon helper' }).click();
  await page.getByRole('button', { name: 'Close Paimon helper' }).click();
  await expect(illustration).toHaveAttribute('src', /gi\.yatta\.moe/);
  await expect.poll(() => illustration.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  await page.locator('.equipped-item__image').first().scrollIntoViewIfNeeded();
  await expect(page.locator('img.equipped-item__image').first()).toHaveAttribute('src', /gi\.yatta\.moe/);
});

test('failed artwork becomes a decorative placeholder without breaking the build', async ({ page }) => {
  await mockSources(page, { imagesUnavailable: true });
  await page.goto('/profile/800000001/characters/10000002-201');
  await expect(page.locator('.showcase-build-hero__image.image-fallback .asset-placeholder--character')).toBeVisible();
  await expect(page.locator('.showcase-stats').first()).toContainText('45.5%');
  await expect(page.locator('.equipped-item__image.image-fallback .asset-placeholder--weapon')).toBeVisible();
});

test('farming checklist has material artwork, working checks, and a narrow layout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockSources(page);
  await page.goto('/materials');
  await page.getByRole('checkbox', { name: 'Kamisato Ayaka' }).check();
  await page.getByRole('button', { name: 'Build checklist' }).click();
  await expect(page.locator('.farming-material-row')).toHaveCount(2);
  // The two source fixtures both report these ascensions: do not double them.
  await expect(page.locator('.farming-material-row').filter({ hasText: 'Mora' })).toContainText('20000');
  await expect(page.locator('.farming-material-row').filter({ hasText: 'Mora' })).not.toContainText('40000');
  const icon = page.locator('.farming-material-row img').first();
  await icon.scrollIntoViewIfNeeded();
  await expect.poll(() => icon.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  await page.locator('.farming-material-row input').first().check();
  await expect(page.locator('.planner-progress')).toContainText('1 of 2');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.farming-material-row')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/farming-plan-mobile.png', fullPage: true });
});

test('weapon and artifact libraries show artwork and all supplied set pieces on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockSources(page);
  await page.goto('/artifacts');
  await page.locator('.entity-card').click();
  await expect(page.locator('.artifact-piece')).toHaveCount(5);
  await expect(page.locator('.drawer')).toContainText('Cryo DMG Bonus +15%');
  await expect(page.locator('.paimon-companion')).toBeHidden();
  await page.locator('.artifact-piece img').first().scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.artifact-piece img').first().evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/artifact-library-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.goto('/weapons');
  await page.locator('.entity-card').click();
  await expect(page.locator('.drawer')).toContainText('Gain an Elemental DMG Bonus.');
  await expect(page.locator('img.drawer-image')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('character skills retain exact provider icon filenames', async ({ page }) => {
  await mockSources(page);
  await page.goto('/characters/10000002');
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  await expect(page.locator('.talent-detail')).toContainText('Kamisato Art: Kabuki');
  await expect(page.locator('.talent-detail img')).toHaveAttribute('src', /Skill_A_01/);
  await page.getByRole('button', { name: 'Constellations', exact: true }).click();
  await expect(page.locator('.constellation-row')).toContainText('Snowswept Sakura');
  await expect(page.locator('.constellation-marker img')).toHaveAttribute('src', /UI_Talent_S_Ayaka_01/);
});

test('duplicate sources retain kit icons, clean descriptions and exact sparse constellation numbers', async ({ page }) => {
  await mockSources(page);
  await page.route('**/genshin.jmp.blue/characters/kamisato-ayaka?**', (route) => route.fulfill({ json: {
    name: characterData.name,
    skillTalents: [{ name: 'Kamisato Art: Kabuki', description: 'Duplicate with no icon.' }],
    constellations: [{ name: 'Snowswept Sakura', description: 'Duplicate first.' }, { name: 'Dance of Suigetsu', description: 'Duplicate sixth.' }],
  } }));
  await page.route('**/api/v5/talents?**', (route) => route.fulfill({ json: {
    name: characterData.name,
    combat1: { name: 'Kamisato Art: Kabuki', description: '<color=#fff>Performs strikes.</color>\\nA &amp; B.' },
    images: { filename_combat1: 'Skill_A_01' },
  } }));
  await page.route('**/api/v5/constellations?**', (route) => route.fulfill({ json: {
    c1: { name: 'Snowswept Sakura', description: 'First effect.' }, c6: { name: 'Dance of Suigetsu', description: 'Sixth effect.' },
    images: { filename_c1: 'UI_Talent_S_Ayaka_01', filename_c6: 'UI_Talent_S_Ayaka_06' },
  } }));
  await page.goto('/characters/10000002');
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  await expect(page.locator('.talent-detail')).toHaveCount(1);
  await expect(page.locator('.talent-detail img')).toHaveAttribute('src', /Skill_A_01/);
  await expect(page.locator('.talent-detail p')).toHaveText('Performs strikes.\nA & B.');
  await page.getByRole('button', { name: 'Constellations', exact: true }).click();
  await expect(page.locator('.constellation-row')).toHaveCount(2);
  await expect(page.locator('.constellation-marker').last()).toContainText('C6');
  await expect(page.locator('.constellation-marker img').last()).toHaveAttribute('src', /UI_Talent_S_Ayaka_06/);
});

test('missing combat and constellation icons use the exact Enka character catalog', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockSources(page);
  await page.route('**/api/v5/talents?**', (route) => route.fulfill({ json: { combat2: { name: 'Kamisato Art: Hyouka', description: 'Deals Cryo DMG.' } } }));
  await page.route('**/api/v5/constellations?**', (route) => route.fulfill({ json: { c6: { name: 'Dance of Suigetsu', description: 'Sixth effect.' } } }));
  await page.goto('/characters/10000002');
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  await expect(page.locator('.talent-detail img')).toHaveAttribute('src', /Skill_S_Ayaka_01/);
  await page.getByRole('button', { name: 'Constellations', exact: true }).click();
  await expect(page.locator('.constellation-marker')).toContainText('C6');
  await expect(page.locator('.constellation-marker img')).toHaveAttribute('src', /UI_Talent_S_Ayaka_06/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('unavailable optional sources settle without endless loading or repeated permanent errors', async ({ page }) => {
  await mockSources(page);
  let secondaryRequests = 0;
  await page.route('**/genshin.jmp.blue/characters/kamisato-ayaka?**', (route) => {
    secondaryRequests++;
    return route.fulfill({ status: 404 });
  });
  await page.route('**/api/v5/talents?**', (route) => route.fulfill({ status: 404 }));
  await page.goto('/characters/10000002');
  await expect(page.locator('.player-build-summary')).toHaveCount(0);
  await expect(page.locator('.character-quickfacts')).not.toContainText('Loading');
  await page.getByRole('button', { name: 'Skills', exact: true }).click();
  await expect(page.locator('.empty-state')).toContainText('Skill descriptions are unavailable');
  expect(secondaryRequests).toBe(1);
  await page.getByRole('button', { name: 'Constellations', exact: true }).click();
  await expect(page.locator('.constellation-row')).toContainText('Snowswept Sakura');
});

test('failed URLs are never displayed and remembered artwork skips failed providers on reload', async ({ page }) => {
  await mockSources(page, { imageFailover: true });
  const requests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('UI_Gacha_AvatarImg_Ayaka')) requests.push(request.url()); });
  await page.addInitScript(() => {
    (window as any).__displayedHeroImages = [];
    new MutationObserver(() => {
      const image = document.querySelector<HTMLImageElement>('img.showcase-build-hero__image');
      if (image?.src) (window as any).__displayedHeroImages.push(image.src);
    }).observe(document, { childList: true, attributes: true, subtree: true, attributeFilter: ['src'] });
  });
  await page.goto('/profile/800000001/characters/10000002-201');
  await expect(page.locator('img.showcase-build-hero__image')).toHaveAttribute('src', /gi\.yatta\.moe/);
  expect(await page.evaluate(() => (window as any).__displayedHeroImages.every((source: string) => source.includes('gi.yatta.moe')))).toBe(true);
  requests.length = 0;
  await page.reload();
  await expect(page.locator('img.showcase-build-hero__image')).toHaveAttribute('src', /gi\.yatta\.moe/);
  expect(requests.every((source) => source.includes('gi.yatta.moe'))).toBe(true);
});

test('HTTP retries only transient or malformed responses and timeouts preserve stale data', async ({ page }) => {
  await mockSources(page);
  let missingRequests = 0;
  let malformedRequests = 0;
  await page.route('https://data.test/missing', (route) => { missingRequests++; return route.fulfill({ status: 404 }); });
  await page.route('https://data.test/malformed', (route) => {
    malformedRequests++;
    return malformedRequests === 1 ? route.fulfill({ body: '{"incomplete":' }) : route.fulfill({ json: { recovered: true } });
  });
  await page.goto('/profile');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/api/http.ts';
    const { getJson } = await import(modulePath);
    const cachePath = '/src/api/cache.ts';
    const { writeCache } = await import(cachePath);
    let missingError = '';
    try { await getJson('https://data.test/missing'); } catch (error) { missingError = String(error); }
    const recovered = await getJson('https://data.test/malformed');
    const originalFetch = window.fetch;
    window.fetch = (input, init) => String(input).startsWith('https://data.test/hanging')
      ? new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }) : originalFetch(input, init);
    try {
      writeCache('deadline-test', { stale: true }, -1);
      const stale = await getJson('https://data.test/hanging', undefined, { cacheKey: 'deadline-test', timeoutMs: 50 });
      let timeoutError = '';
      try { await getJson('https://data.test/hanging-empty', undefined, { timeoutMs: 50 }); } catch (error) { timeoutError = String(error); }
      const controller = new AbortController();
      const aborted = getJson('https://data.test/hanging-aborted', controller.signal, { cacheKey: 'deadline-test', timeoutMs: 1000 }).catch((error: Error) => error.name);
      controller.abort();
      return { missingError, recovered, stale, timeoutError, aborted: await aborted };
    } finally { window.fetch = originalFetch; }
  });
  expect(missingRequests).toBe(1);
  expect(malformedRequests).toBe(2);
  expect(result).toMatchObject({ recovered: { recovered: true }, stale: { stale: true }, aborted: 'AbortError' });
  expect(result.missingError).toContain('404');
  expect(result.timeoutError).toContain('took too long');
});

test.describe('touch phone landscape', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  test('keeps the movable bubble and chat inside the visible viewport', async ({ page }) => {
    await mockSources(page);
    await page.goto('/profile');
    const bubble = page.locator('.paimon-launcher');
    await expect(bubble).toHaveClass(/mobile/);
    const rect = (await bubble.boundingBox())!;
    await page.touchscreen.tap(830, rect.y + 25);
    const helper = page.locator('#paimon-helper');
    await expect(helper).toBeVisible();
    const panel = (await helper.boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.y + panel.height).toBeLessThanOrEqual(390);
  });
});
