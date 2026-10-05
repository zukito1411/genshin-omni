import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, UserRound } from 'lucide-react';
import { assetKey, characterImageSources } from '../api/genshinDev';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { useCharacters } from '../hooks/useCharacters';
import { readOwnedCharacterIds, writeOwnedCharacterIds } from '../utils/playerData';

export function AccountPage() {
  const { allCharacters, loading, error } = useCharacters('');
  const [query, setQuery] = useState('');
  const [ownedIds, setOwnedIds] = useState(readOwnedCharacterIds);
  const owned = new Set(ownedIds);
  const visibleCharacters = useMemo(() => allCharacters.filter((character) =>
    character.name.toLowerCase().includes(query.trim().toLowerCase())), [allCharacters, query]);

  function toggleOwned(id: string) {
    const next = owned.has(id) ? ownedIds.filter((item) => item !== id) : [...ownedIds, id];
    setOwnedIds(next);
    writeOwnedCharacterIds(next);
  }

  return <div>
    <SectionTitle eyebrow="MY ACCOUNT" title="My Roster" description="Mark the characters you own for your team and farming plans. Your selections are saved on this device." />
    <section className="roster-summary panel">
      <div><div className="eyebrow">LOCAL ROSTER</div><h2>{ownedIds.length} characters marked owned</h2><p>Your roster, teams, and farming checks remain in this browser.</p></div><UserRound size={34} />
    </section>
    <div className="callout"><div><h3>View a player’s equipped builds</h3><p>Search a UID to open public character stats, weapons, and artifacts.</p></div><Link className="button secondary" to="/profile">Open UID Search</Link></div>
    <section className="panel roster-picker section-block">
      <div className="plan-output-head"><div><div className="eyebrow">OWNERSHIP</div><h3>Mark your characters</h3></div><input className="search-input" aria-label="Search your roster" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your roster" /></div>
      {loading ? <div className="loading">Loading roster…</div> : error ? <div className="error-box">{error}</div> : visibleCharacters.length ? <div className="roster-character-list">
        {visibleCharacters.map((character) => <button type="button" key={character.id} className={owned.has(character.id) ? 'owned' : ''} onClick={() => toggleOwned(character.id)} aria-pressed={owned.has(character.id)}>
          <AsyncImage src={characterImageSources(character, 'icon')} alt="" className="roster-character-list__image" assetKey={assetKey('characters', character.id)} />
          <span><strong>{character.name}</strong><small>{character.element} · {character.weapon}</small></span>{owned.has(character.id) && <Check size={17} />}
        </button>)}
      </div> : <div className="empty-state">No characters match your search.</div>}
    </section>
  </div>;
}
