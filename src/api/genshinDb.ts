import { getJson } from './http';
import { normalizeCharacter, normalizeEntity, unwrapResult, asArray } from '../utils/normalize';
import type { GenshinCharacter, LibraryEntity } from '../types/genshin';

const BASE_URL = import.meta.env.VITE_GENSHIN_DB_API ?? '/api/genshin-db';

function queryUrl(folder: string, query: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ query, resultLanguage: 'english', ...extra });
  return `${BASE_URL}/${folder}?${params.toString()}`;
}

export async function fetchCharacterNames(signal?: AbortSignal): Promise<GenshinCharacter[]> {
  const url = queryUrl('characters', 'names', { matchCategories: 'true', verboseCategories: 'true' });
  const payload = await getJson<unknown>(url, signal, { cacheKey: 'characters:index', ttlMs: 6 * 60 * 60 * 1000 });
  const result = unwrapResult(payload);
  return asArray(result).map((item) => normalizeCharacter(item)).filter((item) => item.name);
}

export async function fetchCharacter(query: string, signal?: AbortSignal): Promise<GenshinCharacter> {
  const url = queryUrl('characters', query, { matchNames: 'true', matchAltNames: 'true', matchAliases: 'true' });
  const payload = await getJson<unknown>(url, signal, { cacheKey: `character:${query.toLowerCase()}`, ttlMs: 6 * 60 * 60 * 1000 });
  return normalizeCharacter(payload, query);
}

export async function fetchFolderEntities(folder: string, signal?: AbortSignal): Promise<LibraryEntity[]> {
  const url = queryUrl(folder, 'names', { matchCategories: 'true', verboseCategories: 'true' });
  const payload = await getJson<unknown>(url, signal, { cacheKey: `folder-index:${folder}`, ttlMs: 6 * 60 * 60 * 1000 });
  return asArray(unwrapResult(payload)).map((item) => normalizeEntity(item)).filter((item) => item.name);
}

export async function fetchEntity(folder: string, query: string, signal?: AbortSignal): Promise<LibraryEntity> {
  const url = queryUrl(folder, query, { matchNames: 'true', matchAltNames: 'true', matchAliases: 'true' });
  const payload = await getJson<unknown>(url, signal, { cacheKey: `${folder}:${query.toLowerCase()}`, ttlMs: 6 * 60 * 60 * 1000 });
  return normalizeEntity(payload, query);
}


export async function fetchFolder(folder: string, query: string, signal?: AbortSignal): Promise<unknown> {
  const url = queryUrl(folder, query, { matchNames: 'true', matchAltNames: 'true', matchAliases: 'true' });
  return getJson<unknown>(url, signal, { cacheKey: `${folder}:query:${query.toLowerCase()}`, ttlMs: 6 * 60 * 60 * 1000 });
}

export async function fetchStats(folder: 'characters' | 'weapons', query: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const url = queryUrl('stats', query, { folder });
  return getJson<Record<string, unknown>>(url, signal, { cacheKey: `stats:${folder}:${query.toLowerCase()}`, ttlMs: 6 * 60 * 60 * 1000 });
}

export async function fetchConfig(signal?: AbortSignal): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>(`${BASE_URL}/config?resultLanguage=english`, signal, { cacheKey: 'db:config', ttlMs: 24 * 60 * 60 * 1000 });
}
