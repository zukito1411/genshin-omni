import { getJson } from './http';
import type { EnkaMetadata, EnkaProfile } from '../types/enka';

const BASE_URL = 'https://enka.network/api';

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

export async function fetchEnkaByUid(uid: string, signal?: AbortSignal): Promise<EnkaProfile> {
  const clean = uid.trim();
  if (!/^\d{9,10}$/.test(clean)) throw new Error('A Genshin UID should contain 9 or 10 digits.');
  const options = { cacheKey: `enka:uid:${clean}`, ttlMs: 10 * 60 * 1000, staleOnError: true };
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
        { cacheKey: `enka:uid-reader:${clean}`, ttlMs: 10 * 60 * 1000, staleOnError: true },
      );
      return validateProfile(parseReaderPayload(reader));
    } catch {
      throw directError instanceof Error
        ? new Error(`Public UID lookup is unavailable: ${directError.message}`)
        : new Error('Public UID lookup is temporarily unavailable.');
    }
  }
}

export async function fetchEnkaMetadata(signal?: AbortSignal): Promise<EnkaMetadata> {
  const base = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store';
  const options = { ttlMs: 24 * 60 * 60 * 1000, staleOnError: true };
  const requestSignal = signal ?? AbortSignal.timeout(20_000);
  const [characters, localization, namecards, profilePictures] = await Promise.all([
    getJson<EnkaMetadata['characters']>(`${base}/characters.json`, requestSignal, { ...options, cacheKey: 'enka:characters:v1' }),
    getJson<Record<string, Record<string, string>>>(`${base}/loc.json`, requestSignal, { ...options, cacheKey: 'enka:localization:v1' }),
    getJson<NonNullable<EnkaMetadata['namecards']>>(`${base}/namecards.json`, requestSignal, { ...options, cacheKey: 'enka:namecards:v1' }).catch(() => ({})),
    getJson<NonNullable<EnkaMetadata['profilePictures']>>(`${base}/pfps.json`, requestSignal, { ...options, cacheKey: 'enka:pfps:v1' }).catch(() => ({})),
  ]);
  return { characters, text: localization.en ?? {}, namecards, profilePictures };
}
