import { getJson } from './http';

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

export async function fetchEnkaByUid(uid: string): Promise<any> {
  const clean = uid.replace(/\D/g, '');
  if (clean.length !== 9) throw new Error('A Genshin UID should contain 9 digits.');
  const options = { cacheKey: `enka:uid:${clean}`, ttlMs: 10 * 60 * 1000, staleOnError: true };
  try {
    return await getJson<any>(`${BASE_URL}/uid/${clean}/`, undefined, options);
  } catch (directError) {
    // Enka occasionally denies browser-origin requests before a response is
    // exposed to fetch. Keep the app client-only by using the same public
    // reader fallback already used for guide pages, rather than asking users
    // to weaken browser security or provide account credentials.
    try {
      const reader = await getJson<ReaderResponse>(
        `https://r.jina.ai/http://enka.network/api/uid/${clean}/`,
        undefined,
        { cacheKey: `enka:uid-reader:${clean}`, ttlMs: 10 * 60 * 1000, staleOnError: true },
      );
      return parseReaderPayload(reader);
    } catch {
      throw directError instanceof Error
        ? new Error(`Public UID lookup is unavailable: ${directError.message}`)
        : new Error('Public UID lookup is temporarily unavailable.');
    }
  }
}
