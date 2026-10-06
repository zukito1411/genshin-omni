import { containsCredential } from './safety';
export { containsCredential } from './safety';
export interface MemoryFact { key: string; label: string; value: string; updatedAt: number; }
export interface ConversationTurn { id: string; question: string; answer: string; at: number; mathValue?: number; }
export interface Notebook { version: 1; facts: MemoryFact[]; turns: ConversationTurn[]; updatedAt?: number; }
export interface NotebookResult { notebook: Notebook; persistent: boolean; }
const STORAGE_KEY = 'teyvat-atlas:paimon-notebook:v1';
const MAX_FACTS = 80;
const MAX_TURNS = 30;
const empty = (): Notebook => ({ version: 1, facts: [], turns: [] });
let session = empty();
let database: Promise<IDBDatabase | null> | undefined;
let writes: Promise<unknown> = Promise.resolve();

export const memoryKey = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 120);
export function normalizeNotebook(value: unknown): Notebook {
  if (!value || typeof value !== 'object') return empty();
  const record = value as Partial<Notebook>;
  const facts = Array.isArray(record.facts) ? record.facts.filter((fact) => fact && typeof fact.key === 'string' && typeof fact.label === 'string' && typeof fact.value === 'string' && Number.isFinite(fact.updatedAt) && !containsCredential(`${fact.key} ${fact.label} ${fact.value}`))
    .map((fact) => ({ key: memoryKey(fact.key), label: fact.label.slice(0, 120), value: fact.value.slice(0, 600), updatedAt: fact.updatedAt })).filter((fact) => fact.key && fact.value) : [];
  const unique = new Map(facts.map((fact) => [fact.key, fact]));
  const turns = Array.isArray(record.turns) ? record.turns.filter((turn) => turn && typeof turn.id === 'string' && typeof turn.question === 'string' && typeof turn.answer === 'string' && Number.isFinite(turn.at) && !containsCredential(`${turn.question} ${turn.answer}`))
    .map((turn) => ({ id: turn.id.slice(0, 100), question: turn.question.slice(0, 600), answer: turn.answer.slice(0, 2400), at: turn.at, ...(typeof turn.mathValue === 'number' && Number.isFinite(turn.mathValue) ? { mathValue: turn.mathValue } : {}) })) : [];
  return { version: 1, facts: [...unique.values()].sort((a, b) => a.updatedAt - b.updatedAt).slice(-MAX_FACTS), turns: turns.sort((a, b) => a.at - b.at).slice(-MAX_TURNS), updatedAt: typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt) ? record.updatedAt : 0 };
}
function openDatabase() {
  database ??= new Promise<IDBDatabase | null>((resolve) => {
    let done = false;
    const finish = (db: IDBDatabase | null) => {
      if (done) { db?.close(); return; }
      done = true; window.clearTimeout(timer); resolve(db);
    };
    const timer = window.setTimeout(() => finish(null), 800);
    try {
      if (!window.indexedDB) { finish(null); return; }
      const request = window.indexedDB.open('teyvat-atlas:paimon:v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('notebook');
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = undefined; };
        finish(db);
      };
    } catch { finish(null); }
  });
  return database;
}
function storedFallback(): Notebook | undefined {
  try { const value = localStorage.getItem(STORAGE_KEY); if (value) return normalizeNotebook(JSON.parse(value)); } catch { /* Private mode may disable storage. */ }
}
function fallbackRead(): Notebook {
  return storedFallback() ?? session;
}
function latestNotebook(stored: unknown): Notebook {
  const main = normalizeNotebook(stored);
  const fallback = storedFallback();
  // Recover notes written during a transaction outage, including deletion tombstones.
  if (fallback && (!stored || (fallback.updatedAt ?? 0) > (main.updatedAt ?? 0))) return fallback;
  if ((session.updatedAt ?? 0) > (main.updatedAt ?? 0)) return session;
  return stored ? main : fallback ?? session;
}
function changedNotebook(change: (notebook: Notebook) => Notebook, notebook: Notebook): Notebook {
  return normalizeNotebook({ ...change(notebook), updatedAt: Math.max(Date.now(), (notebook.updatedAt ?? 0) + 1) });
}
async function transact(change?: (notebook: Notebook) => Notebook): Promise<NotebookResult> {
  const db = await openDatabase();
  if (db) {
    try {
      return await new Promise<NotebookResult>((resolve, reject) => {
        const tx = db.transaction('notebook', change ? 'readwrite' : 'readonly');
        const timer = window.setTimeout(() => { try { tx.abort(); } catch { /* Already finished. */ } reject(new Error('Notebook storage timed out.')); }, 800);
        const store = tx.objectStore('notebook');
        const request = store.get('state');
        let notebook = empty();
        request.onsuccess = () => {
          notebook = latestNotebook(request.result);
          if (change) { notebook = changedNotebook(change, notebook); store.put(notebook, 'state'); }
        };
        tx.oncomplete = () => {
          window.clearTimeout(timer); session = notebook;
          if (change) { try { localStorage.removeItem(STORAGE_KEY); } catch { /* Prevent old fallback copies from resurrecting forgotten facts. */ } }
          resolve({ notebook, persistent: true });
        };
        tx.onerror = tx.onabort = () => { window.clearTimeout(timer); reject(new Error('Notebook storage unavailable.')); };
      });
    } catch { /* Keep the assistant functional when browser storage is restricted. */ }
  }
  const notebook = change ? changedNotebook(change, fallbackRead()) : normalizeNotebook(fallbackRead());
  session = notebook;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook)); return { notebook, persistent: true }; }
  catch { return { notebook, persistent: false }; }
}
export const loadNotebook = () => writes.then(() => transact());
export function updateNotebook(change: (notebook: Notebook) => Notebook): Promise<NotebookResult> {
  // Serialize this tab, with IndexedDB's transaction handling concurrent tabs.
  const next = writes.then(() => transact(change));
  writes = next.catch(() => undefined);
  return next;
}
export function putFact(notebook: Notebook, label: string, value: string): Notebook {
  const key = memoryKey(label);
  return { ...notebook, facts: [...notebook.facts.filter((fact) => fact.key !== key), { key, label: label.trim(), value: value.trim(), updatedAt: Date.now() }] };
}
export function searchFacts(notebook: Notebook, query: string): MemoryFact[] {
  const stop = new Set(['what', 'who', 'is', 'are', 'the', 'a', 'an', 'my', 'do', 'you', 'know', 'remember', 'about', 'tell', 'me', 'please', 'paimon', 'did', 'say', 'have', 'find', 'search', 'recall', 'for', 'i', 'our', 'we', 'said']);
  const words = memoryKey(query).split(' ').filter((word) => !stop.has(word));
  if (!words.length) return [];
  return notebook.facts.map((fact) => {
    const keyWords = new Set(memoryKey(fact.label).split(' '));
    const valueWords = new Set(memoryKey(fact.value).split(' '));
    const keyMatches = words.filter((word) => keyWords.has(word)).length;
    const valueMatches = words.filter((word) => valueWords.has(word)).length;
    return { fact, score: keyMatches / words.length * 4 + valueMatches / words.length * 2, matched: keyMatches + valueMatches };
  }).filter((entry) => entry.score >= 2 && entry.matched >= Math.ceil(words.length / 2))
    .sort((a, b) => b.score - a.score || b.fact.updatedAt - a.fact.updatedAt).slice(0, 3).map((entry) => entry.fact);
}
