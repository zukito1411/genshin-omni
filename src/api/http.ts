import { readCache, writeCache } from './cache';

export async function getJson<T>(url: string, signal?: AbortSignal, options?: { cacheKey?: string; ttlMs?: number; staleOnError?: boolean }): Promise<T> {
  const cacheKey = options?.cacheKey ?? url;
  const ttlMs = options?.ttlMs ?? 30 * 60 * 1000;
  const cached = readCache<T>(cacheKey);
  if (cached && !cached.stale) return cached.value;

  try {
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const value = await response.json() as T;
    writeCache(cacheKey, value, ttlMs);
    return value;
  } catch (error) {
    if (options?.staleOnError !== false && cached) return cached.value;
    throw error;
  }
}
