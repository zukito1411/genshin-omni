import { fetchCharacter, fetchFolder, fetchStats } from './genshinDb';
import { fetchEntityDetail } from './genshinDev';
import type { AggregatedCharacter } from '../types/genshin';
import { combinedKitLists, fillKitArtwork, needsKitArtwork } from '../utils/characterKit';
import { fetchEnkaCharacters } from './enka';

const characterMemory = new Map<string, { value: AggregatedCharacter; expiresAt: number }>();
const characterRequests = new Map<string, Promise<AggregatedCharacter>>();
const characterUpdates = new Map<string, Set<(value: AggregatedCharacter) => void>>();
const partialCharacters = new Map<string, AggregatedCharacter>();

export async function fetchAggregatedCharacter(query: string, signal?: AbortSignal, onUpdate?: (value: AggregatedCharacter) => void): Promise<AggregatedCharacter> {
  const key = query.trim().toLowerCase();
  const cached = characterMemory.get(key);
  if (cached && cached.expiresAt > Date.now()) { if (!signal?.aborted) onUpdate?.(cached.value); return cached.value; }
  const listener = (value: AggregatedCharacter) => { if (!signal?.aborted) onUpdate?.(value); };
  const listeners = characterUpdates.get(key) ?? new Set();
  if (onUpdate) { listeners.add(listener); characterUpdates.set(key, listeners); }
  const stopListening = () => listeners.delete(listener);
  signal?.addEventListener('abort', stopListening, { once: true });
  const finish = () => { stopListening(); signal?.removeEventListener('abort', stopListening); };
  const partial = partialCharacters.get(key);
  if (partial) listener(partial);
  const shared = characterRequests.get(key);
  if (shared) return shared.finally(finish);
  const request = (async () => {
    // This complete character record is shared and cached across navigation. Do
    // not bind it to a page-owned abort signal, or React's route cleanup can
    // cancel the request that the next visit is already waiting for.
    void signal;
    const base = await fetchCharacter(query);
    const detailQuery =
      /^traveler[-\s]+(?:anemo|geo|electro|dendro|hydro|pyro|cryo)$/i.test(query)
        ? query
        : base.name || query;
    let current: AggregatedCharacter = { ...base, stats: {}, secondary: {}, sources: [] };
    const publish = () => {
      partialCharacters.set(key, current);
      for (const update of characterUpdates.get(key) ?? []) update(current);
    };
    publish();
    const hydrate = async <T,>(field: string, promise: Promise<T>): Promise<T> => {
      const value = await promise;
      current = field === 'stats'
        ? { ...current, stats: value as Record<string, unknown> }
        : { ...current, secondary: { ...current.secondary, [field]: value } };
      publish();
      return value;
    };
    const [stats, secondary, talents, constellations] = await Promise.allSettled([
      hydrate('stats', fetchStats('characters', detailQuery)),
      hydrate('dev', fetchEntityDetail('characters', detailQuery)),
      hydrate('talents', fetchFolder('talents', detailQuery)),
      hydrate('constellations', fetchFolder('constellations', detailQuery)),
    ]);
    const dev = secondary.status === 'fulfilled' && secondary.value && typeof secondary.value === 'object' ? secondary.value : {};
    const kitTalents = combinedKitLists(['talents', 'skillTalents', 'passiveTalents'], talents.status === 'fulfilled' ? talents.value : null, base.raw, dev);
    const kitConstellations = combinedKitLists(['constellations', 'constellationTalents'], constellations.status === 'fulfilled' ? constellations.value : null, base.raw, dev);
    let kit = { talents: kitTalents, constellations: kitConstellations };
    if (base.gameId && needsKitArtwork(kitTalents, kitConstellations)) {
      const catalog = await fetchEnkaCharacters().catch((): Awaited<ReturnType<typeof fetchEnkaCharacters>> => ({}));
      const element = ({ Cryo: 'Ice', Anemo: 'Wind', Electro: 'Electric', Hydro: 'Water', Pyro: 'Fire', Geo: 'Rock', Dendro: 'Grass' } as Record<string, string>)[String(base.element)];
      const variant = Object.entries(catalog).find(([id, metadata]) => id.startsWith(`${base.gameId}-`) && metadata.Element === element)?.[1];
      // Traveler kits differ by element; never apply its default Anemo record
      // to another element if a matching variant is not present.
      const definition = String(base.id) === 'traveler' ? variant : catalog[String(base.gameId)] ?? variant;
      kit = fillKitArtwork(kitTalents, kitConstellations, definition);
    }
    const result = {
      ...base,
      stats: stats.status === 'fulfilled' ? stats.value : {},
      secondary: { dev, ...kit },
      sources: [
        { provider: 'GenshinDB', url: 'https://genshin-db-api.vercel.app/', fetchedAt: Date.now() },
        { provider: 'genshin.dev / public image CDNs', url: 'https://github.com/genshindev/api', fetchedAt: Date.now() },
      ],
    };
    current = result;
    publish();
    // Keep retrying incomplete enrichments on future calls. A transient source
    // failure must not become the permanent in-memory representation of a
    // character for the rest of the session.
    if (stats.status === 'fulfilled' && Object.keys(result.stats).length > 0 && talents.status === 'fulfilled' && constellations.status === 'fulfilled' && kit.talents.length > 0 && kit.constellations.length > 0 && !needsKitArtwork(kit.talents, kit.constellations)) {
      characterMemory.set(key, { value: result, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
    }
    return result;
  })().finally(() => { characterRequests.delete(key); partialCharacters.delete(key); characterUpdates.delete(key); });
  characterRequests.set(key, request);
  return request.finally(finish);
}
