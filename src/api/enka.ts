import { getJson } from './http';

const BASE_URL = import.meta.env.VITE_ENKA_API ?? 'https://enka.network/api';

export async function fetchEnkaByUid(uid: string): Promise<any> {
  const clean = uid.replace(/\D/g, '');
  if (clean.length !== 9) throw new Error('A Genshin UID should contain 9 digits.');
  return getJson<any>(`${BASE_URL}/uid/${clean}/`, undefined, { cacheKey: `enka:uid:${clean}`, ttlMs: 10 * 60 * 1000, staleOnError: true });
}
