import { bundledArtifactNames } from '../data/artifactNames';
import type { ArtifactNameCatalog } from '../types/enka';
import { asArray, asRecord, firstString, unwrapResult } from '../utils/normalize';
import { getJson } from './http';

const SLOTS = ['flower', 'plume', 'sands', 'goblet', 'circlet'];

export function artifactIconKey(icon?: string): string {
  return icon?.split('/').pop()?.split('?')[0].replace(/\.(png|webp|jpg|jpeg)$/i, '') ?? '';
}

export function buildArtifactNames(payload: unknown): ArtifactNameCatalog {
  const names: ArtifactNameCatalog = {};
  for (const entry of asArray(unwrapResult(payload))) {
    const set = asRecord(entry);
    const images = asRecord(set.images);
    const setName = firstString(set.name);
    if (!setName) continue;
    for (const slot of SLOTS) {
      const piece = asRecord(set[slot]);
      const name = firstString(piece.name);
      const icon = artifactIconKey(firstString(images[`filename_${slot}`], images[slot], images[`mihoyo_${slot}`]));
      if (!name || !/^UI_RelicIcon_[\w-]+$/.test(icon)) continue;
      names[icon] = { name, setName, equipType: firstString(piece.relicType), setId: typeof set.id === 'number' ? set.id : undefined };
    }
  }
  return names;
}

export async function fetchArtifactNames(signal: AbortSignal, forceRefresh = false): Promise<ArtifactNameCatalog> {
  try {
    // Optional enrichment must not hold the rest of the build behind an outage.
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(6_000)]);
    const payload = await getJson<unknown>('https://genshin-db-api.vercel.app/api/v5/artifacts?query=names&matchCategories=true&verboseCategories=true&resultLanguage=english', bounded, { cacheKey: 'enka:artifact-names:v1', ttlMs: 24 * 60 * 60 * 1000, forceRefresh });
    return { ...bundledArtifactNames, ...buildArtifactNames(payload) };
  } catch {
    return bundledArtifactNames;
  }
}
