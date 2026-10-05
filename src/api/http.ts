import { readCache, writeCache } from './cache';

const inFlight = new Map<string, Promise<unknown>>();
const RETRY_DELAYS_MS = [250, 750];

interface RequestOptions { cacheKey?: string; ttlMs?: number; staleOnError?: boolean; forceRefresh?: boolean; timeoutMs?: number; }

function requestDeadline(signal?: AbortSignal, timeoutMs = 15_000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, timeoutMs);
  return { signal: controller.signal, dispose: () => { window.clearTimeout(timer); signal?.removeEventListener('abort', abort); } };
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function shouldRetry(response: Response): boolean {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}

function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer = 0;
    const abort = () => { window.clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new DOMException('Request aborted', 'AbortError')); };
    const finish = () => { signal?.removeEventListener('abort', abort); resolve(); };
    timer = window.setTimeout(finish, delay);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

async function fetchWithRetry(url: string, signal: AbortSignal | undefined, accept: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, { signal, headers: { Accept: accept } });
      if (response.ok || !shouldRetry(response) || attempt === RETRY_DELAYS_MS.length) return response;
      await response.body?.cancel();
      lastError = new Error(`Request failed (${response.status})`);
    } catch (error) {
      if (signal?.aborted || isAbort(error)) throw error;
      lastError = error;
    }
    await waitForRetry(RETRY_DELAYS_MS[attempt], signal);
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed.');
}

export async function getJson<T>(url: string, signal?: AbortSignal, options?: RequestOptions): Promise<T> {
  const cacheKey = options?.cacheKey ?? url;
  const ttlMs = options?.ttlMs ?? 30 * 60 * 1000;
  const shareRequest = !signal;
  const cached = readCache<T>(cacheKey);
  if (cached && !cached.stale && !options?.forceRefresh) return cached.value;

  // A caller-owned signal must never cancel a request another screen is
  // awaiting. Only share signal-free requests; page requests stay isolated.
  const pending = shareRequest ? inFlight.get(cacheKey) : undefined;
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    const deadline = requestDeadline(signal, options?.timeoutMs);
    try {
      let value: T | undefined;
      let parseError: unknown;
      // A few public endpoints occasionally answer 200 with a truncated body.
      // JSON parsing is therefore part of a successful request, not a final
      // operation after it. Fetch a new response once before surfacing it.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetchWithRetry(url, deadline.signal, 'application/json');
          if (!response.ok) throw new Error(`Request failed (${response.status})`);
          const body = (await response.text()).trim();
          if (!body) throw new SyntaxError('Provider returned an empty JSON response.');
          value = JSON.parse(body) as T;
          break;
        } catch (error) {
          if (deadline.signal.aborted || isAbort(error) || !(error instanceof SyntaxError)) throw error;
          parseError = error;
          if (attempt === 0) await waitForRetry(RETRY_DELAYS_MS[0], deadline.signal);
        }
      }
      if (value === undefined) throw parseError instanceof Error ? parseError : new Error('Provider returned invalid JSON.');
      writeCache(cacheKey, value, ttlMs);
      return value;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (options?.staleOnError !== false && cached) return cached.value;
      if (deadline.signal.aborted) throw new Error('The data source took too long to respond. Please try again.');
      throw error;
    } finally {
      deadline.dispose();
      if (shareRequest) inFlight.delete(cacheKey);
    }
  })();
  if (shareRequest) inFlight.set(cacheKey, request);
  return request;
}

export async function getText(url: string, signal?: AbortSignal, options?: RequestOptions): Promise<string> {
  const cacheKey = options?.cacheKey ?? url;
  const ttlMs = options?.ttlMs ?? 30 * 60 * 1000;
  const shareRequest = !signal;
  const cached = readCache<string>(cacheKey);
  if (cached && !cached.stale && !options?.forceRefresh) return cached.value;

  const pending = shareRequest ? inFlight.get(cacheKey) : undefined;
  if (pending) return pending as Promise<string>;

  const request = (async () => {
    const deadline = requestDeadline(signal, options?.timeoutMs);
    try {
      const response = await fetchWithRetry(url, deadline.signal, 'text/plain');
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const value = await response.text();
      writeCache(cacheKey, value, ttlMs);
      return value;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (options?.staleOnError !== false && cached) return cached.value;
      if (deadline.signal.aborted) throw new Error('The data source took too long to respond. Please try again.');
      throw error;
    } finally {
      deadline.dispose();
      if (shareRequest) inFlight.delete(cacheKey);
    }
  })();
  if (shareRequest) inFlight.set(cacheKey, request);
  return request;
}
