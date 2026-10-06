import { boundedJson, ConnectionError } from './hoyolab-provider.mjs';

const catalogBase = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store';
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const id = (value) => Number.isSafeInteger(value) && value > 0 && value <= 1e10 ? String(value) : '';
function filename(value, kind) {
  if (typeof value !== 'string' || value.length > 200) return '';
  const pattern = kind === 'avatar' ? /^(?:\/ui\/)?(UI_AvatarIcon_[\w-]+\.(?:png|webp|jpe?g))$/ : /^(?:\/ui\/)?(UI_NameCardPic_[\w-]+\.(?:png|webp|jpe?g))$/;
  return value.match(pattern)?.[1] ?? '';
}
export function normalizeArtwork(uid, player, catalogs) {
  const picture = object(player?.profilePicture);
  const custom = object(catalogs.pfps?.[id(picture.id)]);
  const avatarId = id(picture.avatarId);
  const avatar = catalogs.avatars?.[avatarId];
  // Older Traveler profiles can reference an avatar whose catalog entries are
  // split by element. Use a variant only when its exact image is unambiguous.
  const variants = avatar ? [object(avatar)] : avatarId ? Object.entries(object(catalogs.avatars)).filter(([key]) => key.startsWith(`${avatarId}-`)).map(([, entry]) => object(entry)) : [];
  const unique = (values) => { const images = [...new Set(values.filter(Boolean))]; return images.length === 1 ? images[0] : ''; };
  const costume = unique(variants.map((entry) => { const skin = object(entry.Costumes?.[id(picture.costumeId)]); return filename(skin.Icon ?? skin.icon, 'avatar'); }));
  const side = unique(variants.map((entry) => filename(typeof entry.SideIconName === 'string' ? entry.SideIconName.replace('_Side_', '_') : '', 'avatar')));
  const card = object(catalogs.namecards?.[id(player?.nameCardId) || id(player?.namecardId)]);
  return {
    uid,
    avatar: filename(custom.IconPath ?? custom.iconPath, 'avatar') || costume || side,
    namecard: filename(card.Icon ?? card.icon, 'namecard'),
  };
}

// Public-only Enka reads. Never accepts or forwards HoYoLAB credentials.
export function createEnkaArtworkProvider(fetcher = fetch, now = Date.now) {
  const catalogs = new Map(); // At most three small, public catalog entries.
  const players = new Map(); // At most 64 normalized public-artwork entries.
  async function read(url, signal) {
    const response = await fetcher(url, { method: 'GET', redirect: 'error', credentials: 'omit', signal, headers: { Accept: 'application/json', 'User-Agent': 'TeyvatAtlas/1.0 (profile-artwork)' } });
    if (!response.ok) { const error = new Error('Artwork source unavailable.'); error.status = response.status; throw error; }
    return boundedJson(response, 2_000_000, signal);
  }
  async function catalog(kind) {
    let entry = catalogs.get(kind);
    if (entry?.until > now()) return entry.promise;
    const legacy = { avatars: 'characters', pfps: 'pfps', namecards: 'namecards' }[kind];
    const signal = AbortSignal.timeout(6000);
    entry = { until: now() + 86400_000, promise: read(`${catalogBase}/gi/${kind}.json`, signal).catch((error) => {
      if (error.status !== 404 || signal.aborted) throw error;
      return read(`${catalogBase}/${legacy}.json`, signal);
    }).then(object) };
    catalogs.set(kind, entry);
    entry.promise.catch(() => { if (catalogs.get(kind) === entry) { entry.until = now() + 60_000; entry.promise = Promise.resolve({}); } });
    return entry.promise;
  }
  return {
    async get(uid) {
      if (typeof uid !== 'string' || !/^\d{9,10}$/.test(uid)) throw new ConnectionError('artwork_unavailable', 503);
      const time = now();
      for (const [key, entry] of players) if (entry.until <= time) players.delete(key);
      let entry = players.get(uid);
      if (entry) return entry.promise;
      if (players.size >= 64) players.delete(players.keys().next().value);
      entry = { until: time + 60_000, promise: null };
      entry.promise = (async () => {
        try {
          const data = object(await read(`https://enka.network/api/uid/${uid}/`, AbortSignal.timeout(8000)));
          if (data.uid !== undefined && String(data.uid) !== uid) throw new Error('Artwork identity mismatch.');
          if (!data.playerInfo || typeof data.playerInfo !== 'object' || Array.isArray(data.playerInfo)) throw new Error('Artwork unavailable.');
          const player = data.playerInfo;
          // No nickname, signature, build, stat, or raw player payload is cached.
          const selectors = { profilePicture: { id: player.profilePicture?.id, avatarId: player.profilePicture?.avatarId, costumeId: player.profilePicture?.costumeId }, nameCardId: id(player.nameCardId) ? player.nameCardId : player.namecardId };
          const [pfps, avatars, namecards] = await Promise.all([
            id(selectors.profilePicture.id) ? catalog('pfps').catch(() => ({})) : {},
            id(selectors.profilePicture.avatarId) ? catalog('avatars').catch(() => ({})) : {},
            id(selectors.nameCardId) ? catalog('namecards').catch(() => ({})) : {},
          ]);
          const artwork = normalizeArtwork(uid, selectors, { pfps, avatars, namecards });
          // Respect the upstream refresh interval, with a bounded local lifetime.
          const ttl = Number.isFinite(data.ttl) ? Math.max(60, Math.min(data.ttl, 600)) : 300;
          entry.until = now() + (artwork.avatar && artwork.namecard ? ttl * 1000 : 60_000);
          return artwork;
        } catch { throw new ConnectionError('artwork_unavailable', 503); }
      })();
      players.set(uid, entry);
      // Keep a short cooldown after failures rather than hammering the public API.
      void entry.promise.catch(() => undefined);
      return entry.promise;
    },
  };
}
