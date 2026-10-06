import { fetchCharacter } from './genshinDb';
import { fetchEntityDetail } from './genshinDev';

const hasValues = (value: unknown) => Array.isArray(value) ? value.length > 0 : Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);

/** The same two cost sources as the full build, without stats/constellation/icon requests. */
export async function fetchCharacterMaterials(query: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const character = await fetchCharacter(query, signal);
  const dev = await fetchEntityDetail('characters', character.name || query, signal).catch((error) => {
    if (signal?.aborted) throw error;
    return {} as Record<string, unknown>;
  });
  const { costs: rawCosts, ascension_materials: rawAscension, ...rawDetails } = character.raw;
  const { costs: devCosts, ascension_materials: devAscension, ...devDetails } = dev;
  const costs = hasValues(rawCosts) ? rawCosts : devCosts;
  const ascension = hasValues(rawAscension) ? rawAscension : devAscension;
  return { ...rawDetails, ...devDetails, ...(hasValues(costs) ? { costs } : { ascension_materials: ascension }) };
}
