import { expect, test } from '@playwright/test';
import { normalizeBuild, normalizeCharacter, normalizeProfile, imageUrl } from '../netlify/lib/hoyolab-data.mjs';
import { createHoyolabProvider } from '../netlify/lib/hoyolab-provider.mjs';
import { profileImageSources } from '../src/utils/profileImages';

const role = { uid: '800000001', region: 'os_asia' };
const icon = 'https://upload-os-bbs.hoyolab.com/game_record/UI_AvatarIcon_Ayaka.png';
// Raw character/detail structure, not an already flattened library model.
const raw = {
  property_map: { '1': { name: 'HP' }, '2': { name: 'Base ATK' }, '3': { name: 'CRIT DMG' } },
  list: [{
    base: { id: 10000002, name: 'Kamisato Ayaka', icon, element: 'Cryo', level: 90, rarity: 5, fetter: 10, actived_constellation_num: 3, weapon: { name: 'Incomplete base weapon' } },
    image: icon, base_properties: [{ property_type: 1, final: 18000 }], extra_properties: [{ property_type: 3, final: '210.1%' }], selected_properties: [{ property_type: 3, final: '210.1%' }],
    weapon: { name: 'Mistsplitter Reforged', level: 90, affix_level: 1, rarity: 5, icon, main_property: { property_type: 2, final: '674' }, sub_property: { property_type: 3, final: '44.1%' } },
    relics: [{ name: 'Snowswept Memory', icon, level: 20, pos_name: 'Flower of Life', set: { name: 'Blizzard Strayer' }, main_property: { property_type: 1, value: '4,780' }, sub_property_list: [{ property_type: 3, value: '21.0%' }] }],
    skills: [{ name: 'Kamisato Art: Hyouka', icon, level: 10, desc: '<b>Deals Cryo DMG.</b>' }], constellations: [{ name: 'Snowswept Sakura', icon, is_actived: true, effect: 'Reduces cooldown.' }],
  }],
};

test('raw nested HoYoLAB builds preserve identity, detailed equipment, mapped stats, talents and constellations', () => {
  const before = structuredClone(raw), build = normalizeBuild(raw, 10000002);
  expect(build).toMatchObject({ id: 10000002, name: 'Kamisato Ayaka', level: 90, friendship: 10, constellation: 3 });
  expect(build.weapon).toMatchObject({ name: 'Mistsplitter Reforged', refinement: 1, stats: [{ label: 'Base ATK', value: '674' }, { label: 'CRIT DMG', value: '44.1%' }] });
  expect(build.stats).toEqual([{ label: 'HP', value: '18000' }, { label: 'CRIT DMG', value: '210.1%' }]);
  expect(build.artifacts[0]).toMatchObject({ name: 'Snowswept Memory', set: 'Blizzard Strayer', stats: [{ label: 'HP', value: '4,780' }, { label: 'CRIT DMG', value: '21.0%' }] });
  expect(build.skills[0]).toMatchObject({ name: 'Kamisato Art: Hyouka', level: 10, description: 'Deals Cryo DMG.' });
  expect(build.constellations[0].unlocked).toBe(true);
  expect(normalizeBuild(raw, 10000003)).toBeNull();
  expect(raw).toEqual(before);
  expect(normalizeCharacter({ id: 10000062, name: 'Aloy', rarity: 105 }).rarity).toBe(5);
});

test('character provider sends the owned character_ids and normalizes actual raw detail responses', async () => {
  let input: any;
  const provider = createHoyolabProvider(async (url: string, options: any) => {
    expect(url).toBe('https://sg-public-api.hoyolab.com/event/game_record/genshin/api/character/detail');
    input = JSON.parse(options.body);
    return Response.json({ retcode: 0, data: raw });
  });
  const build = await provider.character({ accountId: '123', token: 'fake-not-a-real-credential', version: 'v2' }, role, 10000002);
  expect(input).toEqual({ role_id: role.uid, server: role.region, character_ids: [10000002] });
  expect(build.weapon.name).toBe('Mistsplitter Reforged');
});

test('exploration retains alternative artwork, safe CDN transforms, zero progress and non-reputation regions', () => {
  const data = normalizeProfile(role, { world_explorations: [
    { name: 'Nod-Krai', icon: '', inner_icon: `${icon}?x-oss-process=image/resize,w_100`, cover: icon.replace('Ayaka', 'Cover'), exploration_percentage: 0, level: 0 },
    { name: 'Windrest Peak', icon: 'https://evil.test/image.png', background_image: icon, exploration_percentage: 1001 },
  ] }, null, null, 1, []);
  expect(data.exploration[0]).toMatchObject({ name: 'Nod-Krai', icon, icons: [icon, icon.replace('Ayaka', 'Cover')], percentage: 0, level: 0 });
  expect(data.exploration[1]).toMatchObject({ icon, percentage: 100.1 });
  for (const bad of [icon + '?token=secret', icon + '?x-oss-process=image&secret=x', icon.replace('https:', 'http:'), 'https://user:password@hoyolab.com/x.png', 'https://hoyolab.com:8443/x.png']) expect(imageUrl(bad)).toBe('');
  expect(profileImageSources([icon, icon])).toHaveLength(5);
  expect(profileImageSources(icon)[0]).toBe(icon);
  expect(profileImageSources(icon)).toContain('https://enka.network/ui/UI_AvatarIcon_Ayaka.png');
  expect(profileImageSources('https://upload-os-bbs.hoyolab.com/non-game-image.png')).toHaveLength(1);
});
