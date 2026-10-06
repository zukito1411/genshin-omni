import { Link } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, BookOpen, Boxes, Compass, ListChecks, Search, ShieldCheck, Sparkles, Swords, Users } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { HomeNews } from '../components/HomeNews';
import { useCharacters } from '../hooks/useCharacters';
import '../styles/home.css';

const tools = [
  { to: '/characters', title: 'Characters', icon: Users, kind: 'character', description: 'Explore builds, stats, talents, teams, and materials.', action: 'Browse characters' },
  { to: '/weapons', title: 'Weapons', icon: Swords, kind: 'weapon', description: 'Compare weapon stats and find options for your characters.', action: 'Browse weapons' },
  { to: '/artifacts', title: 'Artifacts', icon: Boxes, kind: 'artifact', description: 'Discover set bonuses and where they fit in your builds.', action: 'Browse artifacts' },
  { to: '/teams', title: 'Team Builder', icon: BookOpen, kind: 'team', description: 'Build a four-character squad and save your favorite teams.', action: 'Build a team' },
];
const shortcuts = [
  { to: '/me', title: 'My Profile', icon: ShieldCheck, description: 'Your connected account' },
  { to: '/profile', title: 'UID Search', icon: Search, description: 'Public equipped builds' },
  { to: '/materials', title: 'Farming Plan', icon: ListChecks, description: 'Plan your materials' },
  { to: '/map', title: 'Interactive Map', icon: Compass, description: 'Find resources' },
  { to: '/account', title: 'My Roster', icon: Users, description: 'Your local collection' },
  { to: '/compare', title: 'Compare', icon: ArrowLeftRight, description: 'Compare character builds' },
  { to: '/guides', title: 'Guides & FAQ', icon: BookOpen, description: 'Get player guidance' },
  { to: '/teams', title: 'Saved Teams', icon: Swords, description: 'Plan your next squad' },
];

export function DashboardPage() {
  const { allCharacters, loading } = useCharacters('');
  return <div className="home-page">
    <section className="hero-card home-hero">
      <div className="home-hero__veil" aria-hidden="true" />
      <div className="hero-copy home-hero__copy">
        <div className="eyebrow hero-eyebrow"><Sparkles size={13} aria-hidden="true" />TEYVAT ATLAS</div>
        <div className="hero-kicker">GENSHIN IMPACT COMPANION</div>
        <h1>Build your characters.<br />Plan your adventure.</h1>
        <p className="hero-description">Find builds, weapons, artifacts, teams, and materials in one place.</p>
        <div className="hero-actions"><Link to="/characters" className="button primary">Browse Characters <ArrowRight size={15} aria-hidden="true" /></Link><Link to="/teams" className="button secondary">Build a Team</Link></div>
        <div className="hero-stats"><div><strong>{loading ? '—' : allCharacters.length}</strong><span>characters</span></div><div><strong>7</strong><span>elements</span></div><div><strong>∞</strong><span>builds to explore</span></div></div>
        <a className="home-tools-jump" href="#home-tools">Explore player tools <ArrowRight size={14} aria-hidden="true" /></a>
      </div>
      <HomeNews />
    </section>
    <section id="home-tools" className="section-block home-tools">
      <SectionTitle eyebrow="EXPLORE" title="What do you want to do?" description="Start with a character, a weapon, an artifact set, or a team." />
      <div className="feature-grid four">{tools.map(({ to, title, icon: Icon, kind, description, action }) => <Link key={to} to={to} className={`feature-card feature-card--${kind}`}><Icon size={24} aria-hidden="true" /><h3>{title}</h3><p>{description}</p><span>{action}<ArrowRight size={13} aria-hidden="true" /></span></Link>)}</div>
    </section>
    <section className="panel home-panel home-panel--sources">
      <div className="panel-ornament" aria-hidden="true" />
      <SectionTitle eyebrow="QUICK ACCESS" title="Keep playing" description="Your account, daily plans, and exploration tools are one tap away." />
      <div className="home-quick-grid">{shortcuts.map(({ to, title, icon: Icon, description }) => <Link key={title} to={to} className="home-quick-card"><Icon size={20} aria-hidden="true" /><div><strong>{title}</strong><span>{description}</span></div><ArrowRight size={15} aria-hidden="true" /></Link>)}</div>
    </section>
    <section className="callout home-callout"><div><div className="eyebrow">READY TO BUILD?</div><h3>Choose your next adventure.</h3><p>Pick a character and see their weapons, artifacts, talents, teams, and materials.</p></div><Link className="button secondary" to="/characters">Browse Characters <ArrowRight size={14} aria-hidden="true" /></Link></section>
  </div>;
}
