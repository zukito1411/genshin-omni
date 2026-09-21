import { getJson } from './http';
import { normalizeCharacter, normalizeEntity, unwrapResult, asArray } from '../utils/normalize';
import type { GenshinCharacter, LibraryEntity } from '../types/genshin';
import { fetchGenshinBuildsAssetMap, findGenshinBuildsAsset } from './genshinDev';

const BASE_URL = 'https://genshin-db-api.vercel.app/api/v5';

function queryUrl(folder: string, query: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ query, resultLanguage: 'english', ...extra });
  return `${BASE_URL}/${folder}?${params.toString()}`;
}

function providerCharacterQuery(query: string): string {
  return /^traveler$/i.test(query) ? 'Aether' : query;
}

async function enrichCharacterAsset(character: GenshinCharacter, signal?: AbortSignal): Promise<GenshinCharacter> {
  // GenshinDB already gives detailed records their official card/portrait.
  // Do not delay opening the character page behind a scraped asset index when
  // usable artwork is already present.
  if (character.images.image || character.images.card || character.images.portrait || character.images.icon) return character;
  const assets = await fetchGenshinBuildsAssetMap('characters', signal).catch(() => ({}) as Record<string, string>);
  const image = findGenshinBuildsAsset(assets, character.name);
  return image ? { ...character, images: { ...character.images, image } } : character;
}

export async function fetchCharacterNames(signal?: AbortSignal): Promise<GenshinCharacter[]> {
  try {
    const payload = await getJson<unknown>(queryUrl('characters', 'names', { matchCategories: 'true', verboseCategories: 'true' }), signal, { cacheKey: 'characters:index:v5', ttlMs: 6 * 60 * 60 * 1000 });
    const result = unwrapResult(payload);
    const characters = asArray(result).map((item) => normalizeCharacter(item, typeof item === 'string' ? item : '')).filter((item) => item.name);
    if (!characters.length) throw new Error('GenshinDB returned an empty character index.');
    const traveler = characters.find((item) => /^(?:aether|lumine)$/i.test(item.name));
    const withoutTravelerChoices = characters.filter((item) => !/^(?:aether|lumine)$/i.test(item.name));
    if (traveler) withoutTravelerChoices.unshift({ ...traveler, id: 'traveler', name: 'Traveler' });
    const roster = withoutTravelerChoices;
    const sparse = roster.filter((item) => !item.element || !item.weapon || !item.rarity).length > roster.length * 0.5;
    const buildAssets = await fetchGenshinBuildsAssetMap('characters', signal).catch(() => ({}) as Record<string, string>);
    const enrichedRoster = roster.map((character) => {
      const image = findGenshinBuildsAsset(buildAssets, character.name);
      return image ? { ...character, images: { ...character.images, image } } : character;
    });
    if (!sparse) return enrichedRoster;
    try {
      const allPayload = await getJson<unknown>(`${'https://genshin.jmp.blue'}/characters/all?lang=en`, signal, { cacheKey: 'characters:all:fallback:v2', ttlMs: 12 * 60 * 60 * 1000 });
      const all = asArray(allPayload).map((item) => normalizeCharacter(item)).filter((item) => item.name);
      if (all.length) return all;
    } catch { /* Keep the GenshinDB index if enrichment is unavailable. */ }
    return enrichedRoster;
  } catch (primaryError) {
    const fallbackUrl = `${'https://genshin.jmp.blue'}/characters`;
    try {
      const ids = await getJson<unknown>(fallbackUrl, signal, { cacheKey: 'characters:index:fallback:v2', ttlMs: 6 * 60 * 60 * 1000 });
      const names = asArray(ids).map((item) => typeof item === 'string' ? item : '').filter(Boolean);
      if (!names.length) throw primaryError;
      return names.map((name) => normalizeCharacter(name, name));
    } catch { throw primaryError; }
  }
}

export async function fetchCharacter(query: string, signal?: AbortSignal): Promise<GenshinCharacter> {
  const providerQuery = providerCharacterQuery(query);
  try {
    const payload = await getJson<unknown>(queryUrl('characters', providerQuery, { matchNames: 'true', matchAltNames: 'true', matchAliases: 'true' }), signal, { cacheKey: `character:v4:${query.toLowerCase()}`, ttlMs: 6 * 60 * 60 * 1000 });
    const character = await enrichCharacterAsset(normalizeCharacter(payload, providerQuery), signal);
    return /^traveler$/i.test(query) ? { ...character, id: 'traveler', name: 'Traveler' } : character;
  } catch (primaryError) {
    const id = providerQuery.toLowerCase().replace(/\s+/g, '-');
    try {
      const payload = await getJson<unknown>(`${'https://genshin.jmp.blue'}/characters/${encodeURIComponent(id)}?lang=en`, signal, { cacheKey: `character:fallback:v4:${id}`, ttlMs: 6 * 60 * 60 * 1000 });
      const character = await enrichCharacterAsset(normalizeCharacter(payload, providerQuery), signal);
      return /^traveler$/i.test(query) ? { ...character, id: 'traveler', name: 'Traveler' } : character;
    } catch { throw primaryError; }
  }
}

export async function fetchFolderEntities(folder: string, signal?: AbortSignal): Promise<LibraryEntity[]> {
  const payload = await getJson<unknown>(queryUrl(folder, 'names', { matchCategories: 'true', verboseCategories: 'true' }), signal, { cacheKey: `folder-index:${folder}:v6`, ttlMs: 6 * 60 * 60 * 1000 });
  const entities = asArray(unwrapResult(payload)).map((item) => normalizeEntity(item)).filter((item) => item.name);
  const buildAssets = await fetchGenshinBuildsAssetMap(folder as 'weapons' | 'artifacts', signal).catch(() => ({}) as Record<string, string>);
  return entities.map((entity) => {
    const image = findGenshinBuildsAsset(buildAssets, entity.name);
    return image ? { ...entity, icon: image } : entity;
  });
}
export async function fetchEntity(folder: string, query: string, signal?: AbortSignal): Promise<LibraryEntity> {
  const payload = await getJson<unknown>(queryUrl(folder, query, { matchNames: 'true', matchAltNames: 'true', matchAliases: 'true' }), signal, { cacheKey: `${folder}:v7:${query.toLowerCase()}`, ttlMs: 6 * 60 * 60 * 1000 });
  const entity = normalizeEntity(payload, query);
  const assetFolder = folder === 'weapons' || folder === 'artifacts' ? folder : null;
  const assets = assetFolder ? await fetchGenshinBuildsAssetMap(assetFolder, signal).catch(() => ({}) as Record<string, string>) : {};
  const image = findGenshinBuildsAsset(assets, entity.name);
  return image ? { ...entity, icon: image } : entity;
}
export async function fetchFolder(folder: string, query: string, signal?: AbortSignal): Promise<unknown> {
  return getJson<unknown>(queryUrl(folder, providerCharacterQuery(query), { matchNames: 'true', matchAltNames: 'true', matchAliases: 'true' }), signal, { cacheKey: `${folder}:query:v2:${query.toLowerCase()}`, ttlMs: 6 * 60 * 60 * 1000 });
}
export async function fetchStats(folder: 'characters' | 'weapons', query: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>(queryUrl('stats', providerCharacterQuery(query), { folder }), signal, { cacheKey: `stats:${folder}:v2:${query.toLowerCase()}`, ttlMs: 6 * 60 * 60 * 1000 });
}
export async function fetchConfig(signal?: AbortSignal): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>(`${BASE_URL}/config?resultLanguage=english`, signal, { cacheKey: 'db:config', ttlMs: 24 * 60 * 60 * 1000 });
}
