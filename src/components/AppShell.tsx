import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, Boxes, Compass, Home, Map, Search, Shield, Sparkles, Swords, Users } from 'lucide-react';
import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useCharacters } from '../hooks/useCharacters';
import { clearAppCache } from '../api/cache';

const localDevMap = import.meta.env.DEV && window.location.hostname === 'localhost';
const nav = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/characters', label: 'Characters', icon: Users },
  { to: '/weapons', label: 'Weapons', icon: Swords },
  { to: '/artifacts', label: 'Artifacts', icon: Boxes },
  { to: '/teams', label: 'Team Builder', icon: Shield },
  ...(localDevMap ? [{ to: '/map', label: 'Interactive Map', icon: Map }] : []),
  { to: '/guides', label: 'Guides / FAQ', icon: BookOpen },
];

export function AppShell() {
  const [query, setQuery] = useState('');
  const [openSearch, setOpenSearch] = useState(false);
  const [activeMatch, setActiveMatch] = useState(0);
  const navigate = useNavigate();
  const { allCharacters } = useCharacters('');
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return [];
    return allCharacters.filter((character) => [character.name, character.title, character.element, character.weapon, character.region]
      .filter(Boolean).join(' ').toLowerCase().includes(search)).slice(0, 6);
  }, [allCharacters, query]);

  function chooseCharacter(id: string) {
    navigate(`/characters/${encodeURIComponent(id)}`);
    setOpenSearch(false);
    setQuery('');
    setActiveMatch(0);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const exact = matches.find((character) => character.name.toLowerCase() === query.trim().toLowerCase());
    const selected = exact ?? matches[activeMatch] ?? matches[0];
    if (selected) chooseCharacter(selected.name);
    else if (query.trim()) { navigate(`/characters?search=${encodeURIComponent(query.trim())}`); setOpenSearch(false); }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setOpenSearch(false); return; }
    if (!matches.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpenSearch(true); setActiveMatch((current) => (current + 1) % matches.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setOpenSearch(true); setActiveMatch((current) => (current - 1 + matches.length) % matches.length); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">
        <img src="/assets/logo.png" alt="Teyvat Atlas logo" />
      </div><div><strong>Teyvat Atlas</strong><span>Genshin player library</span></div></div>
      <nav className="sidebar-nav">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={17} />{label}</NavLink>)}</nav>
      <div className="sidebar-footer"><span>Player tools</span><button className="text-button" onClick={() => { clearAppCache(); window.location.reload(); }}>Refresh latest data</button></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <form className="global-search" onSubmit={submit}>
          <Search size={17} /><input value={query} onFocus={() => setOpenSearch(true)} onKeyDown={handleSearchKeyDown} onChange={(event) => { setQuery(event.target.value); setOpenSearch(true); setActiveMatch(0); }} placeholder="Search characters..." aria-label="Search characters" aria-expanded={openSearch && matches.length > 0} aria-controls="character-search-results" />
          {openSearch && matches.length > 0 && <div id="character-search-results" className="search-results">{matches.map((character, index) => <button key={character.id} className={index === activeMatch ? 'active' : ''} type="button" onMouseDown={(event) => { event.preventDefault(); chooseCharacter(character.name); }}>{character.name}<span>{[character.element, character.weapon].filter(Boolean).join(' / ')}</span></button>)}</div>}
        </form>
        <div className="topbar-actions"><button className="pill interactive" onClick={() => navigate('/sources')}><Compass size={13} /> Sources</button></div>
      </header>
      <div className="page" onClick={() => openSearch && setOpenSearch(false)}><Outlet /></div>
    </main>
  </div>;
}
