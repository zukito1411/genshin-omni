import { getJson } from './http';
import type { EnkaMetadata, EnkaProfile } from '../types/enka';
import { fetchArtifactNames } from './artifactNames';

const BASE_URL = 'https://enka.network/api';

/** Lightweight shared catalog for missing kit icons, without fetching UID/locales. */
export async function fetchEnkaCharacters(signal?: AbortSignal, forceRefresh = false): Promise<EnkaMetadata['characters']> {
  const base = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store';
  const load = (file: string) => getJson<EnkaMetadata['characters']>(`${base}/${file}.json`, signal, {
    cacheKey: `enka:metadata:v2:${file}`, ttlMs: 24 * 60 * 60 * 1000, forceRefresh, timeoutMs: 6_000,
  });
  try { return await load('gi/avatars'); }
  catch (error) {
    if (signal?.aborted || !(error instanceof Error) || !error.message.includes('(404)')) throw error;
    return load('characters');
  }
}

type ReaderResponse = {
  data?: {
    content?: string;
  };
};

function parseReaderPayload(payload: ReaderResponse): unknown {
  const content = payload.data?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('The public Enka reader returned an unexpected response.');
  }
  return JSON.parse(content) as unknown;
}

function validateProfile(payload: unknown): EnkaProfile {
  if (!payload || typeof payload !== 'object' || !('playerInfo' in payload) ||
      !payload.playerInfo || typeof payload.playerInfo !== 'object' || Array.isArray(payload.playerInfo)) {
    throw new Error('The provider did not return a public player profile.');
  }
  const profile = payload as EnkaProfile;
  if (profile.avatarInfoList !== undefined && (!Array.isArray(profile.avatarInfoList) ||
      profile.avatarInfoList.some((avatar) => !avatar || typeof avatar !== 'object' ||
        (!avatar.avatarId && !avatar.avatarID) ||
        (avatar.equipList !== undefined && !Array.isArray(avatar.equipList)) ||
        (avatar.talentIdList !== undefined && !Array.isArray(avatar.talentIdList))))) {
    throw new Error('The provider returned invalid character showcase data.');
  }
  return profile;
}

export async function fetchEnkaByUid(uid: string, signal?: AbortSignal, forceRefresh = false): Promise<EnkaProfile> {
  const clean = uid.trim();
  if (!/^\d{9,10}$/.test(clean)) throw new Error('A Genshin UID should contain 9 or 10 digits.');
  const options = { cacheKey: `enka:uid:${clean}`, ttlMs: 10 * 60 * 1000, staleOnError: true, forceRefresh };
  try {
    return validateProfile(await getJson<unknown>(`${BASE_URL}/uid/${clean}/`, signal, options));
  } catch (directError) {
    if (signal?.aborted) throw directError;
    // Enka occasionally denies browser-origin requests before a response is
    // exposed to fetch. Keep the app client-only by using the same public
    // reader fallback already used for guide pages, rather than asking users
    // to weaken browser security or provide account credentials.
    try {
      const reader = await getJson<ReaderResponse>(
        `https://r.jina.ai/http://enka.network/api/uid/${clean}/`,
        signal,
        { cacheKey: `enka:uid-reader:${clean}`, ttlMs: 10 * 60 * 1000, staleOnError: true, forceRefresh },
      );
      return validateProfile(parseReaderPayload(reader));
    } catch {
      throw directError instanceof Error
        ? new Error(`Public UID lookup is unavailable: ${directError.message}`)
        : new Error('Public UID lookup is temporarily unavailable.');
    }
  }
}

export async function fetchEnkaMetadata(signal?: AbortSignal, forceRefresh = false, onUpdate?: (metadata: EnkaMetadata) => void): Promise<EnkaMetadata> {
  const base = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store';
  const options = { ttlMs: 24 * 60 * 60 * 1000, staleOnError: true, forceRefresh };
  const requestSignal = signal ?? AbortSignal.timeout(20_000);
  const load = <T,>(file: string) => getJson<T>(`${base}/${file}.json`, requestSignal, { ...options, cacheKey: `enka:metadata:v2:${file}` });
  let partial: EnkaMetadata = { characters: {}, text: {} };
  let charactersReady = false;
  let textReady = false;
  let currentText: Record<string, string> = {};
  let legacyText: Record<string, string> = {};
  const publish = () => { if (charactersReady && textReady && !signal?.aborted) onUpdate?.(partial); };
  const hydrate = async <K extends keyof EnkaMetadata>(field: K, promise: Promise<EnkaMetadata[K]>) => {
    const value = await promise;
    partial = { ...partial, [field]: value };
    if (field === 'characters') charactersReady = true;
    publish();
    return value;
  };
  const hydrateText = async (promise: Promise<Record<string, Record<string, string>>>, legacy = false) => {
    const value = await promise;
    if (legacy) legacyText = value.en ?? {};
    else { currentText = value.en ?? {}; textReady = true; }
    partial = { ...partial, text: { ...legacyText, ...currentText } };
    publish();
    return value;
  };
  const [characters, localization, legacyLocalization, namecards, profilePictures, weapons, relics, curves, relicLevels, affixes, artifactNames] = await Promise.all([
    hydrate('characters', load<EnkaMetadata['characters']>('gi/avatars').catch(() => load<EnkaMetadata['characters']>('characters'))),
    hydrateText(load<Record<string, Record<string, string>>>('gi/locs').catch(() => load<Record<string, Record<string, string>>>('loc'))),
    // The current catalog uses set names, while older snapshots can still
    // contain hashes for individual artifact-piece names.
    hydrateText(load<Record<string, Record<string, string>>>('loc').catch(() => ({})), true),
    hydrate('namecards', load<NonNullable<EnkaMetadata['namecards']>>('gi/namecards').catch(() => load<NonNullable<EnkaMetadata['namecards']>>('namecards')).catch(() => ({}))),
    hydrate('profilePictures', load<NonNullable<EnkaMetadata['profilePictures']>>('gi/pfps').catch(() => load<NonNullable<EnkaMetadata['profilePictures']>>('pfps')).catch(() => ({}))),
    hydrate('weapons', load<NonNullable<EnkaMetadata['weapons']>>('gi/weapons').catch(() => ({}))),
    hydrate('relics', load<NonNullable<EnkaMetadata['relics']>>('gi/relics').catch(() => ({}))),
    hydrate('curves', load<NonNullable<EnkaMetadata['curves']>>('gi/curves').catch(() => ({}))),
    hydrate('relicLevels', load<NonNullable<EnkaMetadata['relicLevels']>>('gi/relic_levels').catch(() => ({}))),
    hydrate('affixes', load<NonNullable<EnkaMetadata['affixes']>>('gi/affixes').catch(() => ({}))),
    hydrate('artifactNames', fetchArtifactNames(requestSignal, forceRefresh)),
  ]);
  return { characters, text: { ...('en' in legacyLocalization ? legacyLocalization.en : {}), ...(localization.en ?? {}) }, namecards, profilePictures, weapons, relics, curves, relicLevels, affixes, artifactNames };
}
