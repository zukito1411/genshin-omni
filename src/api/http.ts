import { readCache, writeCache } from './cache';

const inFlight = new Map<string, Promise<unknown>>();

export async function getJson<T>(url: string, signal?: AbortSignal, options?: { cacheKey?: string; ttlMs?: number; staleOnError?: boolean }): Promise<T> {
  const cacheKey = options?.cacheKey ?? url;
  const ttlMs = options?.ttlMs ?? 30 * 60 * 1000;
  const cached = readCache<T>(cacheKey);
  if (cached && !cached.stale) return cached.value;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const value = await response.json() as T;
      writeCache(cacheKey, value, ttlMs);
      return value;
    } catch (error) {
      if (options?.staleOnError !== false && cached) return cached.value;
      throw error;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, request);
  return request;
}

export async function getText(url: string, signal?: AbortSignal, options?: { cacheKey?: string; ttlMs?: number; staleOnError?: boolean }): Promise<string> {
  const cacheKey = options?.cacheKey ?? url;
  const ttlMs = options?.ttlMs ?? 30 * 60 * 1000;
  const cached = readCache<string>(cacheKey);
  if (cached && !cached.stale) return cached.value;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending as Promise<string>;

  const request = (async () => {
    try {
      const response = await fetch(url, { headers: { Accept: 'text/plain' } });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const value = await response.text();
      writeCache(cacheKey, value, ttlMs);
      return value;
    } catch (error) {
      if (options?.staleOnError !== false && cached) return cached.value;
      throw error;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, request);
  return request;
}
