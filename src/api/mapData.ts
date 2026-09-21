import { getJson } from './http';

const MARKER_DATA_URL = 'https://game-data.lemonapi.com/gim/markers_all.v5.json';

interface MarkerPayload {
  headers?: string[];
  data?: Array<Array<string | number>>;
}

export interface LiveMapMarker {
  id: number;
  type: string;
  name: string;
  mapId: number;
  level: number;
  x: number;
  y: number;
}

// Names published by the map's companion data and used for useful local search.
// Unknown labels remain visible as a generic community marker rather than being dropped.
const MARKER_NAMES: Record<string, string> = {
  o8: 'Mondstadt Shrine of Depths', o9: 'Liyue Shrine of Depths',
  o17: 'Common Chest', o18: 'Warming Seelie', o44: 'Exquisite Chest',
  o45: 'Precious Chest', o46: 'Luxurious Chest', o64: 'Time Trial Challenge',
  o141: 'Crimson Agate', o148: 'Warming Seelie', o186: 'Puzzle Chest',
  o212: 'Inazuma Shrine of Depths', o269: 'Remarkable Chest',
  o411: 'Sumeru Shrine of Depths', o509: 'Fontaine Shrine of Depths',
  o577: 'Natlan Shrine of Depths', o703: 'Borderland Shrine of Depths',
};

function markerName(type: string): string {
  return MARKER_NAMES[type] ?? `Community marker (${type})`;
}

export async function fetchLiveMapMarkers(signal?: AbortSignal): Promise<LiveMapMarker[]> {
  const payload = await getJson<MarkerPayload>(MARKER_DATA_URL, signal, {
    cacheKey: 'map:community-markers:v1',
    ttlMs: 15 * 60 * 1000,
  });
  const headers = payload.headers ?? [];
  const index = (name: string) => headers.indexOf(name);
  const idIndex = index('id');
  const typeIndex = index('type');
  const mapIndex = index('mid');
  const levelIndex = index('level');
  const xIndex = index('lng');
  const yIndex = index('lat');
  if (!payload.data?.length || [idIndex, typeIndex, mapIndex, levelIndex, xIndex, yIndex].some((value) => value < 0)) {
    throw new Error('The community marker data has an unexpected format.');
  }

  return payload.data
    .map((row): LiveMapMarker | null => {
      const id = Number(row[idIndex]);
      const mapId = Number(row[mapIndex]);
      const level = Number(row[levelIndex]);
      const x = Number(row[xIndex]);
      const y = Number(row[yIndex]);
      const type = String(row[typeIndex] ?? '');
      if (!Number.isFinite(id) || !Number.isFinite(mapId) || !Number.isFinite(level) || !Number.isFinite(x) || !Number.isFinite(y) || !type) return null;
      return { id, type, name: markerName(type), mapId, level, x, y };
    })
    .filter((marker): marker is LiveMapMarker => Boolean(marker));
}
