/** Ordered results with a small, bounded worker pool and navigation cancellation. */
export async function mapConcurrent<T, R>(items: readonly T[], limit: number, work: (item: T, index: number) => Promise<R>, signal?: AbortSignal): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
      const index = cursor++;
      results[index] = await work(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.floor(limit))) }, worker));
  return results;
}
