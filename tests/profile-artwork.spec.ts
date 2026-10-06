import { expect, test } from '@playwright/test';
import { createEnkaArtworkProvider, normalizeArtwork } from '../netlify/lib/enka-artwork.mjs';

const uid = '800000001';
const catalogs = {
  pfps: { '200': { IconPath: '/ui/UI_AvatarIcon_Ayaka_Circle.png' } },
  avatars: { '10000002': { SideIconName: '/ui/UI_AvatarIcon_Side_Ayaka.png', Costumes: { '200201': { Icon: '/ui/UI_AvatarIcon_AyakaCostumeFruhling.png' } } } },
  namecards: { '210003': { Icon: '/ui/UI_NameCardPic_Ambor_P.jpg' } },
};

test('profile artwork resolves custom circles, exact costumes, legacy avatar IDs and namecard aliases', () => {
  expect(normalizeArtwork(uid, { profilePicture: { id: 200, avatarId: 10000002 }, nameCardId: 210003 }, catalogs)).toEqual({ uid, avatar: 'UI_AvatarIcon_Ayaka_Circle.png', namecard: 'UI_NameCardPic_Ambor_P.jpg' });
  expect(normalizeArtwork(uid, { profilePicture: { avatarId: 10000002, costumeId: 200201 }, namecardId: 210003 }, catalogs).avatar).toBe('UI_AvatarIcon_AyakaCostumeFruhling.png');
  expect(normalizeArtwork(uid, { profilePicture: { avatarId: 10000002 } }, catalogs).avatar).toBe('UI_AvatarIcon_Ayaka.png');
  expect(normalizeArtwork(uid, { profilePicture: { id: 999999999 }, nameCardId: 999999999 }, catalogs)).toEqual({ uid, avatar: '', namecard: '' });
  const traveler = { ...catalogs, avatars: { '10000005-501': { SideIconName: '/ui/UI_AvatarIcon_Side_PlayerBoy.png' }, '10000005-701': { SideIconName: '/ui/UI_AvatarIcon_Side_PlayerBoy.png' } } };
  expect(normalizeArtwork(uid, { profilePicture: { avatarId: 10000005 }, nameCardId: 0, namecardId: 210003 }, traveler)).toEqual({ uid, avatar: 'UI_AvatarIcon_PlayerBoy.png', namecard: 'UI_NameCardPic_Ambor_P.jpg' });
  traveler.avatars['10000005-701'].SideIconName = '/ui/UI_AvatarIcon_Side_Different.png';
  expect(normalizeArtwork(uid, { profilePicture: { avatarId: 10000005 } }, traveler).avatar).toBe('');
});

test('artwork normalization returns only selected filenames and rejects arbitrary URLs and malformed catalog paths', () => {
  const unsafe = { pfps: { '200': { IconPath: 'https://evil.test/UI_AvatarIcon_Test.png' } }, avatars: {}, namecards: { '210003': { Icon: '/ui/../private.json' } } };
  const artwork = normalizeArtwork(uid, { profilePicture: { id: 200 }, nameCardId: 210003, nickname: 'do-not-return', signature: 'password=secret' }, unsafe);
  expect(artwork).toEqual({ uid, avatar: '', namecard: '' });
  expect(normalizeArtwork(uid, { profilePicture: { id: 200 }, nameCardId: 210003 }, { ...unsafe, pfps: { '200': { IconPath: '/ui/UI_WeaponIcon_Wrong.png' } } }).avatar).toBe('');
});

test('artwork reads never send credentials, load only needed public catalogs, and reuse normalized selectors within the provider TTL', async () => {
  const calls: Array<{ url: string; options: any }> = [];
  let time = 1000;
  const provider = createEnkaArtworkProvider(async (url: string, options: object) => {
    calls.push({ url, options });
    return Response.json(url.includes('/api/uid/') ? { uid, ttl: 120, playerInfo: { nickname: 'do-not-cache', signature: 'password=fixture', profilePicture: { id: 200 }, nameCardId: 210003 }, avatarInfoList: [{ ignored: true }] } : url.endsWith('/pfps.json') ? catalogs.pfps : catalogs.namecards);
  }, () => time);
  const results = await Promise.all([provider.get(uid), provider.get(uid)]);
  expect(results[0]).toEqual({ uid, avatar: 'UI_AvatarIcon_Ayaka_Circle.png', namecard: 'UI_NameCardPic_Ambor_P.jpg' });
  expect(calls).toHaveLength(3);
  expect(calls.every((call) => call.options.credentials === 'omit' && call.options.redirect === 'error' && !call.options.headers.Cookie && !call.options.headers.Authorization)).toBe(true);
  expect(calls.some((call) => call.url.includes('avatars.json') || call.url.includes('locs'))).toBe(false);
  time += 90_000; await provider.get(uid); expect(calls).toHaveLength(3);
  time += 40_000; await provider.get(uid); expect(calls).toHaveLength(4); // Catalogs remain public/shared.
  expect(JSON.stringify(results)).not.toContain('password');
});

test('missing metadata is independent per artwork type and legacy catalog fallbacks run only on 404', async () => {
  const calls: string[] = [];
  const provider = createEnkaArtworkProvider(async (url: string) => {
    calls.push(url);
    if (url.includes('/api/uid/')) return Response.json({ playerInfo: { profilePicture: { id: 200 }, nameCardId: 210003 } });
    if (url.includes('/gi/pfps')) return new Response('', { status: 404 });
    if (url.endsWith('/pfps.json')) return Response.json(catalogs.pfps);
    return new Response('', { status: 503 });
  });
  expect(await provider.get(uid)).toEqual({ uid, avatar: 'UI_AvatarIcon_Ayaka_Circle.png', namecard: '' });
  expect(calls.some((url) => url.endsWith('/store/pfps.json'))).toBe(true);
  expect(calls.some((url) => url.endsWith('/store/namecards.json'))).toBe(false);
});

test('malformed, mismatched and unavailable public profiles fail safely and requests remain bounded', async () => {
  for (const data of [{ playerInfo: [] }, { uid: '800000999', playerInfo: {} }, {}]) {
    const provider = createEnkaArtworkProvider(async () => Response.json(data));
    await expect(provider.get(uid)).rejects.toMatchObject({ code: 'artwork_unavailable' });
  }
  let calls = 0;
  let time = 1000;
  const provider = createEnkaArtworkProvider(async () => { calls++; return new Response('private-provider-diagnostic', { status: 429 }); }, () => time);
  await expect(provider.get('http://127.0.0.1/private')).rejects.toMatchObject({ code: 'artwork_unavailable' });
  expect(calls).toBe(0);
  await expect(provider.get(uid)).rejects.toMatchObject({ code: 'artwork_unavailable' });
  await expect(provider.get(uid)).rejects.toMatchObject({ code: 'artwork_unavailable' });
  expect(calls).toBe(1);
  time += 60_001;
  await expect(provider.get(uid)).rejects.toMatchObject({ code: 'artwork_unavailable' });
  expect(calls).toBe(2);
});
