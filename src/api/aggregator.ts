import { fetchCharacter, fetchFolder, fetchStats } from './genshinDb';
import { fetchEntityDetail } from './genshinDev';
import type { AggregatedCharacter } from '../types/genshin';
import { combinedKitLists, fillKitArtwork, needsKitArtwork } from '../utils/characterKit';
import { fetchEnkaCharacters } from './enka';

const characterMemory = new Map<string, { value: AggregatedCharacter; expiresAt: number }>();
const characterRequests = new Map<string, Promise<AggregatedCharacter>>();

export async function fetchAggregatedCharacter(query: string, signal?: AbortSignal): Promise<AggregatedCharacter> {
  const key = query.trim().toLowerCase();
  const cached = characterMemory.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const shared = characterRequests.get(key);
  if (shared) return shared;
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
    const [stats, secondary, talents, constellations] = await Promise.allSettled([
      fetchStats('characters', detailQuery),
      fetchEntityDetail('characters', detailQuery),
      fetchFolder('talents', detailQuery),
      fetchFolder('constellations', detailQuery),
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
    // Keep retrying incomplete enrichments on future calls. A transient source
    // failure must not become the permanent in-memory representation of a
    // character for the rest of the session.
    if (stats.status === 'fulfilled' && Object.keys(result.stats).length > 0 && talents.status === 'fulfilled' && constellations.status === 'fulfilled' && kit.talents.length > 0 && kit.constellations.length > 0 && !needsKitArtwork(kit.talents, kit.constellations)) {
      characterMemory.set(key, { value: result, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
    }
    return result;
  })().finally(() => characterRequests.delete(key));
  characterRequests.set(key, request);
  return request;
}
