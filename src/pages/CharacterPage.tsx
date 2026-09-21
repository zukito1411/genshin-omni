import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Heart, Swords } from 'lucide-react';
import { fetchAggregatedCharacter } from '../api/aggregator';
import { characterImages } from '../api/genshinDev';
import { getGuide } from '../data/guides';
import { AsyncImage } from '../components/AsyncImage';
import { SectionTitle } from '../components/SectionTitle';
import { slugify } from '../utils/normalize';
import { baseStatRows, extractConstellations, extractMaterials, extractTalents, formatValue } from '../utils/genshin';
import type { AggregatedCharacter } from '../types/genshin';

const links = (name: string) => {
  const slug = slugify(name);
  return [
    { label: 'KeqingMains', url: `https://keqingmains.com/?s=${encodeURIComponent(name)}` },
    { label: 'Prydwen', url: `https://www.prydwen.gg/genshin/characters/${slug}` },
    { label: 'Genshin Wiki', url: `https://genshin-impact.fandom.com/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}` },
    { label: 'Honey Hunter', url: `https://www.google.com/search?q=site%3Agensh.honeyhunterworld.com+${encodeURIComponent(name)}` },
  ];
};

export function CharacterPage() {
  const { id = '' } = useParams();
  const [character, setCharacter] = useState<AggregatedCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'skills' | 'constellations' | 'materials' | 'raw'>('overview');
  const [favorite, setFavorite] = useState(() => localStorage.getItem(`favorite:${id}`) === '1');
  const [materialChecks, setMaterialChecks] = useState<Record<string, boolean>>({});

  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(null); fetchAggregatedCharacter(id, controller.signal).then(setCharacter).catch((err) => { if (err?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Unable to load this character.'); }).finally(() => setLoading(false)); return () => controller.abort(); }, [id]);
  const guide = useMemo(() => character ? getGuide(character.id) ?? getGuide(character.name.toLowerCase()) : undefined, [character]);
  if (loading) return <div className="detail-loading"><div className="skeleton-hero" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>;
  if (error || !character) return <div className="error-box"><h2>Character unavailable</h2><p>{error ?? 'No character data was returned.'}</p><Link to="/characters" className="button secondary">Back to character library</Link></div>;

  const raw = character.raw;
  const talents = extractTalents({ ...raw, talents: character.secondary.talents ?? raw.talents });
  const constellations = extractConstellations({ ...raw, constellations: character.secondary.constellations ?? raw.constellations });
  const materials = extractMaterials(raw);
  const statRows = baseStatRows(character.stats);
  const imageSet = characterImages(character.id || character.name);
  const buildLinks = links(character.name);
  function toggleFavorite() { const next = !favorite; setFavorite(next); localStorage.setItem(`favorite:${character!.id}`, next ? '1' : '0'); }

  return <div>
    <Link to="/characters" className="back-link">← Character library</Link>
    <section className={`character-hero ${String(character.element ?? '').toLowerCase()}`}>
      <div className="character-hero__art"><AsyncImage src={character.images.portrait || character.images.card || imageSet.card} alt={character.name} className="character-portrait" fallback={character.name} /></div>
      <div className="character-hero__copy"><div className="hero-meta"><span className={`element-chip large element-${(character.element ?? 'unknown').toLowerCase()}`}>{character.element ?? 'Unknown'}</span><span>{character.weapon ?? 'Weapon'}</span><span>{character.region ?? 'Teyvat'}</span>{character.rarity && <span className="gold-stars">{'★'.repeat(character.rarity)}</span>}</div><div className="eyebrow">{character.title ?? 'Playable character'}</div><h1>{character.name}</h1><p>{character.description ?? 'No description was returned by the current data feed.'}</p><div className="hero-actions"><button className={`button ${favorite ? 'primary' : 'secondary'}`} onClick={toggleFavorite}><Heart size={15} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? 'Saved' : 'Save'}</button><a className="button secondary" href={buildLinks[0].url} target="_blank" rel="noreferrer">Community builds <ExternalLink size={14} /></a></div><div className="source-strip"><span>Live: GenshinDB</span><span>Images: genshin.dev</span><span>Build reference: community sources</span></div></div>
    </section>

    <div className="tabs"><button className={tab === 'overview' ? 'tab active' : 'tab'} onClick={() => setTab('overview')}>Overview</button><button className={tab === 'skills' ? 'tab active' : 'tab'} onClick={() => setTab('skills')}>Skills</button><button className={tab === 'constellations' ? 'tab active' : 'tab'} onClick={() => setTab('constellations')}>Constellations</button><button className={tab === 'materials' ? 'tab active' : 'tab'} onClick={() => setTab('materials')}>Materials</button><button className={tab === 'raw' ? 'tab active' : 'tab'} onClick={() => setTab('raw')}>Source JSON</button></div>

    {tab === 'overview' && <div className="detail-grid"><section className="panel"><SectionTitle eyebrow="BUILD" title="Build workspace" description="Recommendation data is kept separate from raw game data. When a curated guide exists it is shown here; otherwise use the community-source links without inventing a ranking." />{guide ? <><div className="build-stat-grid"><div><span>Roles</span><strong>{guide.role.join(' · ')}</strong></div><div><span>Stat priority</span><strong>{guide.statPriority.join(' → ')}</strong></div><div><span>Talent priority</span><strong>{guide.talentPriority.join(' → ')}</strong></div></div><h3>Weapons</h3><div className="recommend-grid">{guide.weapons.map((weapon) => <article key={weapon.name} className="recommend-card"><div className="recommend-top"><strong>{weapon.name}</strong><span>{weapon.tier}</span></div><p>{weapon.note}</p></article>)}</div><h3>Artifacts</h3><div className="recommend-grid">{guide.artifacts.map((artifact) => <article key={artifact.set} className="recommend-card"><div className="recommend-top"><strong>{artifact.set}</strong><span>{artifact.pieces}</span></div><p>{artifact.note}</p></article>)}</div><div className="stats-inline"><span>Sands: {guide.mainStats.sands}</span><span>Goblet: {guide.mainStats.goblet}</span><span>Circlet: {guide.mainStats.circlet}</span></div></> : <div className="notice"><strong>No curated recommendation override.</strong><p>This app does not pretend there is an objective “best” build. Use the live game data below and cross-check the maintained community theorycrafting sources.</p></div>}<div className="external-source-grid">{buildLinks.map((link) => <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="source-button">{link.label}<ExternalLink size={13} /></a>)}</div></section>
    <section className="panel"><SectionTitle eyebrow="BASE STATS" title="Character progression" /><div className="stat-table-wrap"><table className="stat-table"><thead><tr><th>Level</th><th>HP</th><th>ATK</th><th>DEF</th><th>Specialized</th></tr></thead><tbody>{statRows.map((row) => <tr key={String(row.level)}><td>{String(row.level)}</td><td>{formatValue(row.hp)}</td><td>{formatValue(row.attack)}</td><td>{formatValue(row.defense)}</td><td>{formatValue(row.specialized)}</td></tr>)}</tbody></table></div>{!statRows.length && <div className="empty-state">The current stats endpoint returned no rows for this entry.</div>}</section>
    <section className="panel"><SectionTitle eyebrow="TEAM IDEAS" title="Team references" />{guide?.teams?.length ? guide.teams.map((team) => <article className="team-reference" key={team.name}><strong>{team.name}</strong><div className="member-row">{team.members.map((member) => <span className="member-pill" key={member}>{member}</span>)}</div><p>{team.note}</p></article>) : <div className="notice"><Swords size={16} /><span>Team data is patch-sensitive. Search this character in the community sources above rather than displaying stale hard-coded teams.</span></div>}</section></div>}

    {tab === 'skills' && <section className="panel"><SectionTitle eyebrow="TALENTS" title="Skills & abilities" description="Descriptions are rendered from the current character data response. Numeric values can vary by talent level and are preserved in the source JSON tab." />{talents.length ? <div className="talent-detail-grid">{talents.map((talent, index) => <article className="talent-detail" key={`${talent.name}-${index}`}><div className="talent-index">{index + 1}</div><div><div className="eyebrow">{talent.type ?? 'Talent'}</div><h3>{talent.name}</h3><p>{talent.description ?? 'No description in the current payload.'}</p></div></article>)}</div> : <div className="empty-state">No normalized talent entries were found. Open Source JSON to inspect the provider payload.</div>}</section>}

    {tab === 'constellations' && <section className="panel"><SectionTitle eyebrow="CONSTELLATIONS" title="Constellations" />{constellations.length ? <div className="constellation-list">{constellations.map((entry, index) => <article className="constellation-row" key={`${entry.name}-${index}`}><div className="constellation-number">C{entry.level ?? index + 1}</div><div><h3>{entry.name}</h3><p>{entry.description ?? 'No description in the current payload.'}</p></div></article>)}</div> : <div className="empty-state">No constellation entries were normalized from this response.</div>}</section>}

    {tab === 'materials' && <section className="panel"><SectionTitle eyebrow="ASCENSION / TALENT / COSTS" title="Material references" description="The raw character payload is searched for material/cost structures so the app can remain compatible with data-feed revisions." />{materials.length ? <div className="material-table">{materials.map((material, index) => <label className="material-row" key={`${material.name}-${index}`}><input type="checkbox" checked={materialChecks[material.name] ?? (localStorage.getItem(`material:${character.id}:${material.name}`) === '1')} onChange={(e) => { const checked = e.target.checked; setMaterialChecks((current) => ({ ...current, [material.name]: checked })); localStorage.setItem(`material:${character.id}:${material.name}`, checked ? '1' : '0'); }} /><span>{material.name}</span><strong>{material.amount ?? '—'}</strong><em>{material.category ?? ''}</em></label>)}</div> : <div className="empty-state">No material objects were exposed in this character payload. Provider schema changes are intentionally not masked with invented values.</div>}</section>}

    {tab === 'raw' && <section className="panel"><SectionTitle eyebrow="TRANSPARENCY" title="Aggregated source payload" description="Useful for debugging provider changes and verifying exactly what the app received." /><pre className="data-preview">{JSON.stringify({ character: raw, stats: character.stats, secondary: character.secondary, sources: character.sources }, null, 2)}</pre></section>}
  </div>;
}
