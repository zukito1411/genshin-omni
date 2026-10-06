import { useEffect, useMemo, useState } from 'react';
import { fetchCharacterNames } from '../api/genshinDb';
import type { GenshinCharacter } from '../types/genshin';
import { playerErrorMessage } from '../utils/playerError';

let roster: GenshinCharacter[] | null = null;
let rosterRequest: Promise<GenshinCharacter[]> | null = null;

function loadRoster(): Promise<GenshinCharacter[]> {
  if (roster) return Promise.resolve(roster);
  if (!rosterRequest) {
    rosterRequest = fetchCharacterNames()
      .then((value) => { roster = value; return value; })
      .finally(() => { rosterRequest = null; });
  }
  return rosterRequest;
}

export function useCharacters(search = '', enabled = true) {
  const [characters, setCharacters] = useState<GenshinCharacter[]>(() => roster ?? []);
  const [loading, setLoading] = useState(() => !roster);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let active = true;
    setLoading(!roster);
    setError(null);
    loadRoster()
      .then((value) => { if (active) setCharacters(value); })
      .catch((err) => { if (active) setError(playerErrorMessage(err, 'The character library is temporarily unavailable. Please try again.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((character) => [character.name, character.element, character.weapon, character.region, character.title].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [characters, search]);

  return { characters: filtered, allCharacters: characters, loading, error };
}
