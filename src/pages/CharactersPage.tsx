import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { CharacterCard } from '../components/CharacterCard';
import { SectionTitle } from '../components/SectionTitle';
import { useCharacters } from '../hooks/useCharacters';

export function CharactersPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  useEffect(() => { setSearch(params.get('search') ?? ''); }, [params]);
  const { characters, loading, error } = useCharacters(search);
  const [element, setElement] = useState('All');
  const [rarity, setRarity] = useState('All');
  const [weapon, setWeapon] = useState('All');
  const elements = useMemo(() => ['All', ...Array.from(new Set(characters.map((c) => c.element).filter(Boolean) as string[])).sort()], [characters]);
  const weapons = useMemo(() => ['All', ...Array.from(new Set(characters.map((c) => c.weapon).filter(Boolean) as string[])).sort()], [characters]);
  const filtered = characters.filter((c) => (element === 'All' || c.element === element) && (rarity === 'All' || String(c.rarity) === rarity) && (weapon === 'All' || c.weapon === weapon));
  return <div>
    <SectionTitle eyebrow="CHARACTER DATABASE" title="Playable Character Library" description="Browse the full character roster, then open any character for builds, weapons, artifacts, teams, talents and materials." />
    <div className="toolbar sticky-toolbar"><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, title, element, weapon or region" /><select value={element} onChange={(e) => setElement(e.target.value)}>{elements.map((item) => <option key={item}>{item}</option>)}</select><select value={weapon} onChange={(e) => setWeapon(e.target.value)}>{weapons.map((item) => <option key={item}>{item}</option>)}</select><select value={rarity} onChange={(e) => setRarity(e.target.value)}><option>All</option><option value="5">5★</option><option value="4">4★</option></select></div>
    <div className="results-bar"><span>{loading ? 'Loading...' : `${filtered.length} characters`}</span><span className="muted">Characters available in the library</span></div>
    {loading && <div className="skeleton-grid">{Array.from({ length: 12 }).map((_, i) => <div className="skeleton-card" key={i} />)}</div>}
    {error && <div className="error-box"><strong>Character data could not be loaded.</strong><p>{error}</p><p>Try refreshing cached data from the sidebar or check the provider status.</p></div>}
    {!loading && !error && <div className="character-grid">{filtered.map((character) => <CharacterCard key={character.id || character.name} character={character} />)}</div>}
  </div>;
}
