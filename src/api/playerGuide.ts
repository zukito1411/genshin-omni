import type { CharacterGuide } from '../types/genshin';

export interface LivePlayerGuide extends CharacterGuide {
  source: string;
  sourceUrl: string;
  imageUrl?: string;
  fetchedAt: number;
  materials: Array<{ name: string; amount?: number; icon?: string; source?: string; category?: string }>;
}

/** Load the player-facing build data from the server-side source aggregator. */
export async function fetchPlayerGuide(slug: string, signal?: AbortSignal): Promise<LivePlayerGuide> {
  const response = await fetch(`/api/player/guide?slug=${encodeURIComponent(slug)}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Player guide request failed (${response.status})`);
  return response.json() as Promise<LivePlayerGuide>;
}
