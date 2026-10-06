type Consumer = { resolve: (success: boolean) => void; signal?: AbortSignal; abort: () => void };
type Task = { source: string; priority: number; consumers: Set<Consumer>; cancel?: () => void };
const tasks = new Map<string, Task>();
const queue: Task[] = [];
const ready = new Map<string, number>();
const failed = new Map<string, number>();
const timedOutHosts = new Map<string, { count: number; until: number }>();
const MAX_DOWNLOADS = 4;
let downloading = 0;

const hostOf = (source: string) => { try { return new URL(source, window.location.href).host; } catch { return ''; } };
function trim(map: Map<string, number>) { if (map.size > 512) map.delete(map.keys().next().value!); }
export function invalidateImage(source: string) { ready.delete(source); failed.set(source, Date.now()); trim(failed); }

function drain() {
  queue.sort((a, b) => b.priority - a.priority);
  while (downloading < MAX_DOWNLOADS && queue.length) {
    const task = queue.shift()!;
    if (!task.consumers.size) { tasks.delete(task.source); continue; }
    const coolingDown = timedOutHosts.get(hostOf(task.source));
    if (coolingDown && coolingDown.count >= 2 && coolingDown.until > Date.now()) {
      tasks.delete(task.source);
      for (const consumer of task.consumers) {
        consumer.signal?.removeEventListener('abort', consumer.abort);
        consumer.resolve(false);
      }
      task.consumers.clear();
      continue;
    }
    downloading++;
    const image = new window.Image();
    const host = hostOf(task.source);
    let finished = false;
    const finish = (success: boolean, reason?: 'timeout' | 'cancel') => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (success) { ready.set(task.source, Date.now()); trim(ready); failed.delete(task.source); timedOutHosts.delete(host); }
      else {
        image.src = '';
        if (reason !== 'cancel') invalidateImage(task.source);
        if (reason === 'timeout' && host) {
          const previous = timedOutHosts.get(host);
          timedOutHosts.set(host, { count: (previous && previous.until > Date.now() ? previous.count : 0) + 1, until: Date.now() + 20_000 });
        }
      }
      tasks.delete(task.source);
      for (const consumer of task.consumers) {
        consumer.signal?.removeEventListener('abort', consumer.abort);
        consumer.resolve(success);
      }
      task.consumers.clear();
      downloading--;
      drain();
    };
    const timer = window.setTimeout(() => finish(false, 'timeout'), 8_000);
    task.cancel = () => finish(false, 'cancel');
    image.onload = () => {
      if (!image.naturalWidth) { finish(false); return; }
      void (image.decode?.() ?? Promise.resolve()).catch(() => undefined).then(() => finish(true));
    };
    image.onerror = () => finish(false);
    image.src = task.source;
  }
}

/** Shared decoded results, four downloads at a time, and eager artwork first. */
export function loadImage(source: string, eager: boolean, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if ((ready.get(source) ?? 0) > Date.now() - 10 * 60_000) return Promise.resolve(true);
  if ((failed.get(source) ?? 0) > Date.now() - 60_000) return Promise.resolve(false);
  const hostFailure = timedOutHosts.get(hostOf(source));
  // Only timeouts trip the circuit: an individual missing icon is not a blocked provider.
  if (hostFailure && hostFailure.count >= 2 && hostFailure.until > Date.now()) return Promise.resolve(false);
  let task = tasks.get(source);
  if (!task) { task = { source, priority: eager ? 1 : 0, consumers: new Set() }; tasks.set(source, task); queue.push(task); }
  if (eager) task.priority = 1;
  const current = task;
  const result = new Promise<boolean>((resolve) => {
    const consumer: Consumer = { signal, resolve, abort: () => {
      current.consumers.delete(consumer);
      resolve(false);
      if (!current.consumers.size) current.cancel?.();
    } };
    current.consumers.add(consumer);
    signal.addEventListener('abort', consumer.abort, { once: true });
  });
  drain();
  return result;
}

let observer: IntersectionObserver | undefined;
const waiting = new Map<Element, Set<() => void>>();
/** One observer for every lazy image, rather than one observer per card. */
export function observeImage(target: Element, show: () => void): () => void {
  observer ??= new window.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const callbacks = waiting.get(entry.target);
      waiting.delete(entry.target);
      observer?.unobserve(entry.target);
      callbacks?.forEach((callback) => callback());
    }
  }, { rootMargin: '300px' });
  const callbacks = waiting.get(target) ?? new Set();
  callbacks.add(show);
  waiting.set(target, callbacks);
  observer.observe(target);
  return () => {
    callbacks.delete(show);
    if (!callbacks.size) { waiting.delete(target); observer?.unobserve(target); }
  };
}
