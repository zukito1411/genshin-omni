import { readCache, writeCache } from './cache';

type Entry<T> = { value: T; expiresAt: number; updatedAt: number };
const memory = new Map<string, Entry<unknown>>();
let database: Promise<IDBDatabase | null> | undefined;
let generation = 0;
function remember(key: string, entry: Entry<unknown>) {
  memory.delete(key); memory.set(key, entry);
  if (memory.size > 96) memory.delete(memory.keys().next().value!);
}
function openDatabase(): Promise<IDBDatabase | null> {
  database ??= new Promise((resolve) => {
    if (!window.indexedDB) { resolve(null); return; }
    let done = false;
    const finish = (value: IDBDatabase | null) => {
      if (done) { value?.close(); return; }
      done = true; window.clearTimeout(timer); resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 1000);
    try {
      const request = window.indexedDB.open('teyvat-atlas:responses:v1', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('responses'); };
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = undefined; };
        finish(request.result);
      };
    } catch { finish(null); }
  });
  return database;
}
async function stored<T>(key: string): Promise<Entry<T> | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: Entry<T> | null) => { if (!settled) { settled = true; window.clearTimeout(timer); resolve(value); } };
    const timer = window.setTimeout(() => finish(null), 1000);
    try {
      const request = db.transaction('responses', 'readonly').objectStore('responses').get(key);
      request.onsuccess = () => {
        const entry = request.result as Entry<T> | undefined;
        finish(entry && Number.isFinite(entry.expiresAt) && Number.isFinite(entry.updatedAt) && 'value' in entry ? entry : null);
      };
      request.onerror = () => finish(null);
    } catch { finish(null); }
  });
}
export async function readResponseCache<T>(key: string) {
  const remembered = memory.get(key) as Entry<T> | undefined;
  if (remembered) return { value: remembered.value, stale: Date.now() > remembered.expiresAt, updatedAt: remembered.updatedAt };
  // Small legacy caches remain compatible, including existing offline snapshots.
  const legacy = readCache<T>(key);
  if (legacy) { remember(key, { value: legacy.value, expiresAt: legacy.expiresAt, updatedAt: legacy.updatedAt }); return legacy; }
  const entry = await stored<T>(key);
  if (!entry) return null;
  remember(key, entry);
  return { value: entry.value, stale: Date.now() > entry.expiresAt, updatedAt: entry.updatedAt };
}
export function writeResponseCache<T>(key: string, value: T, ttlMs: number, bodyLength: number) {
  const entry: Entry<T> = { value, expiresAt: Date.now() + ttlMs, updatedAt: Date.now() };
  remember(key, entry);
  if (bodyLength < 64_000) { writeCache(key, value, ttlMs); return; }
  const epoch = generation;
  void openDatabase().then((db) => {
    if (epoch !== generation) return;
    if (!db) { writeCache(key, value, ttlMs); return; }
    try {
      const transaction = db.transaction('responses', 'readwrite');
      transaction.objectStore('responses').put(entry, key);
      transaction.onerror = () => { if (epoch === generation) writeCache(key, value, ttlMs); };
    } catch { writeCache(key, value, ttlMs); }
  });
}
export async function clearResponseCache() {
  generation++; memory.clear();
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 1000);
    const finish = () => { window.clearTimeout(timer); resolve(); };
    try {
      const transaction = db.transaction('responses', 'readwrite');
      transaction.objectStore('responses').clear();
      transaction.oncomplete = finish;
      transaction.onerror = finish;
      transaction.onabort = finish;
    } catch { finish(); }
  });
}
