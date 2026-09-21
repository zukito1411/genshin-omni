import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, Boxes, Compass, Gem, Home, Map, Search, Shield, Sparkles, Swords, Users, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useCharacters } from '../hooks/useCharacters';
import { clearAppCache } from '../api/cache';

const nav = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/characters', label: 'Characters', icon: Users },
  { to: '/weapons', label: 'Weapons', icon: Swords },
  { to: '/artifacts', label: 'Artifacts', icon: Boxes },
  { to: '/teams', label: 'Team Builder', icon: Shield },
  { to: '/materials', label: 'Material Planner', icon: Gem },
  { to: '/map', label: 'Interactive Map', icon: Map },
  { to: '/guides', label: 'Guides / FAQ', icon: BookOpen },
  { to: '/account', label: 'UID Build Lookup', icon: UserRound },
];

export function AppShell() {
  const [query, setQuery] = useState('');
  const [openSearch, setOpenSearch] = useState(false);
  const navigate = useNavigate();
  const { allCharacters } = useCharacters('');
  const matches = query.trim() ? allCharacters.filter((character) => character.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6) : [];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) navigate(`/characters?search=${encodeURIComponent(query.trim())}`);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>Teyvat Atlas</strong><span>Genshin player library</span></div></div>
      <nav className="sidebar-nav">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={17} />{label}</NavLink>)}</nav>
      <div className="sidebar-footer"><span>Player tools</span><button className="text-button" onClick={() => { clearAppCache(); window.location.reload(); }}>Refresh latest data</button></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <form className="global-search" onSubmit={submit}>
          <Search size={17} /><input value={query} onFocus={() => setOpenSearch(true)} onChange={(e) => { setQuery(e.target.value); setOpenSearch(true); }} placeholder="Search characters..." aria-label="Search characters" />
          {openSearch && matches.length > 0 && <div className="search-results">{matches.map((character) => <button key={character.id} type="button" onMouseDown={() => { navigate(`/characters/${encodeURIComponent(character.id)}`); setOpenSearch(false); setQuery(''); }}>{character.name}<span>{character.element} · {character.weapon}</span></button>)}</div>}
        </form>
        <div className="topbar-actions"><button className="pill interactive" onClick={() => navigate('/sources')}><Compass size={13} /> Sources</button></div>
      </header>
      <div className="page" onClick={() => openSearch && setOpenSearch(false)}><Outlet /></div>
    </main>
  </div>;
}
