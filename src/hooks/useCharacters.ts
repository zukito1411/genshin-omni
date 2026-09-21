import { useEffect, useMemo, useState } from 'react';
import { fetchCharacterNames } from '../api/genshinDb';
import type { GenshinCharacter } from '../types/genshin';

export function useCharacters(search = '') {
  const [characters, setCharacters] = useState<GenshinCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchCharacterNames(controller.signal)
      .then(setCharacters)
      .catch((err) => { if (err?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Unable to load character data.'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((character) => [character.name, character.element, character.weapon, character.region, character.title].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [characters, search]);

  return { characters: filtered, allCharacters: characters, loading, error };
}
