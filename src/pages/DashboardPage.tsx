import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Boxes, Compass, Gem, Map, Swords, Users, Sparkles } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { assetKey, characterImageSources } from '../api/genshinDev';
import { useCharacters } from '../hooks/useCharacters';

export function DashboardPage() {
  const { allCharacters, loading } = useCharacters('');
  const favorites = allCharacters.filter((character) => localStorage.getItem(`favorite:${character.id}`) === '1').slice(0, 6);
  const featured = favorites[0] ?? allCharacters[0];
  const featuredImages = featured ? characterImageSources(featured, 'portrait') : [];

  return <div className="home-page">
    <section className="hero-card home-hero">
      <div className="home-hero__veil" />
      <div className="hero-copy home-hero__copy">
        <div className="eyebrow hero-eyebrow"><Sparkles size={13} /> TEYVAT ATLAS · ADVENTURER'S COMPANION</div>
        <div className="hero-kicker">GENSHIN IMPACT PLAYER JOURNAL</div>
        <h1>Your Teyvat adventure, all in one place.</h1>
        <p className="hero-description">Build your characters, plan materials, assemble teams, browse weapons and artifacts, and explore the world without leaving your Atlas.</p>
        <div className="hero-actions">
          <Link to="/characters" className="button primary">Open Character Archive <ArrowRight size={15} /></Link>
          <Link to="/teams" className="button secondary">Forge a Team</Link>
        </div>
        <div className="hero-stats">
          <div><strong>{loading ? '—' : allCharacters.length}</strong><span>characters in the archive</span></div>
          <div><strong>7</strong><span>elements of Teyvat</span></div>
          <div><strong>∞</strong><span>builds to explore</span></div>
        </div>
      </div>
      <div className="home-hero__art-shell">
        <div className="home-hero__sun" />
        <div className="hero-rings home-hero__rings"><span /><span /><span /></div>
        {featured && <AsyncImage src={featuredImages} alt={featured.name} className="home-hero__character" assetKey={assetKey('characters', featured.id || featured.name)} />}
        <div className="home-hero__caption">
          <span>{featured ? featured.name : 'Teyvat Atlas'}</span>
          <small>{featured ? `${featured.element ?? 'Unknown'} · ${featured.weapon ?? 'Adventurer'}` : 'Your personal adventure journal'}</small>
        </div>
      </div>
    </section>

    <section className="section-block home-tools">
      <SectionTitle eyebrow="THE ADVENTURER'S HANDBOOK" title="Everything you need before you set out." description="Built around the things a player actually wants to know: what to build, what to farm, who to pair, and where to go next." />
      <div className="feature-grid six">
        <Link to="/characters" className="feature-card feature-card--character"><Users /><h3>Characters</h3><p>Open any character and see their full player guide, build, materials and team options.</p><span>Open archive <ArrowRight size={13} /></span></Link>
        <Link to="/weapons" className="feature-card feature-card--weapon"><Swords /><h3>Weapons</h3><p>Compare weapons, stats and usable options for the characters you own.</p><span>Browse weapons <ArrowRight size={13} /></span></Link>
        <Link to="/artifacts" className="feature-card feature-card--artifact"><Boxes /><h3>Artifacts</h3><p>Browse sets, bonuses and the characters that can put them to work.</p><span>Browse sets <ArrowRight size={13} /></span></Link>
        <Link to="/materials" className="feature-card feature-card--material"><Gem /><h3>Material Planner</h3><p>Turn character and talent requirements into a checklist you can actually farm.</p><span>Plan a build <ArrowRight size={13} /></span></Link>
        <Link to="/teams" className="feature-card feature-card--team"><BookOpen /><h3>Team Builder</h3><p>Assemble four-character squads and keep your favorite compositions on this device.</p><span>Forge a team <ArrowRight size={13} /></span></Link>
        <Link to="/map" className="feature-card feature-card--map"><Map /><h3>World Map</h3><p>Find specialties, bosses, chests and farming locations while you explore Teyvat.</p><span>Open the map <ArrowRight size={13} /></span></Link>
      </div>
    </section>

    <section className="section-block two-up home-panels">
      <section className="panel home-panel home-panel--favorites">
        <div className="panel-ornament" />
        <SectionTitle eyebrow="YOUR JOURNAL" title="Saved characters" description="Keep the characters you care about one tap away." />
        {favorites.length ? <div className="mini-character-list">{favorites.map((character) => <Link to={`/characters/${encodeURIComponent(character.id)}`} key={character.id}><span>{character.name}</span><small>{character.element} · {character.weapon}</small></Link>)}</div> : <div className="empty-state home-empty">Save characters from their detail pages and they will appear here.</div>}
      </section>
      <section className="panel home-panel home-panel--sources">
        <div className="panel-ornament" />
        <SectionTitle eyebrow="ATLAS SOURCES" title="A living game library" description="The Atlas combines live game data with player-facing guide sources instead of hiding the data behind developer screens." />
        <div className="health-list"><div><Compass size={15} /><span>Game data</span><strong>GenshinDB</strong></div><div><Compass size={15} /><span>Character media</span><strong>genshin.dev</strong></div><div><Compass size={15} /><span>Community builds</span><strong>Public guide sources</strong></div></div>
      </section>
    </section>

    <section className="callout home-callout"><div><div className="eyebrow">ADVENTURE READY</div><h3>Stop jumping between tabs. Keep your build, farming and exploration notes together.</h3><p>Open a character, follow their build, add the materials to your planner, then take the route to the map.</p></div><Link className="button secondary" to="/characters">Start with a character <ArrowRight size={14} /></Link></section>
  </div>;
}
