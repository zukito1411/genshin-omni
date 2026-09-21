import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ExternalLink, Heart, MapPin, Sparkles, Swords } from 'lucide-react';
import { fetchAggregatedCharacter } from '../api/aggregator';
import { characterImages, entityImage } from '../api/genshinDev';
import { getGuide } from '../data/guides';
import { fetchPlayerGuide, type LivePlayerGuide } from '../api/playerGuide';
import { AsyncImage } from '../components/AsyncImage';
import { SectionTitle } from '../components/SectionTitle';
import { slugify } from '../utils/normalize';
import { baseStatRows, extractConstellations, extractMaterials, extractTalents, formatValue } from '../utils/genshin';
import type { AggregatedCharacter, CharacterGuide } from '../types/genshin';

const links = (name: string) => {
  const slug = slugify(name);
  return [
    { label: 'KQM', url: `https://keqingmains.com/?s=${encodeURIComponent(name)}` },
    { label: 'Genshin Wiki', url: `https://genshin-impact.fandom.com/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}` },
    { label: 'Prydwen', url: `https://www.prydwen.gg/genshin/characters/${slug}` },
  ];
};

function sourceLinksForGuide(guide?: CharacterGuide) {
  return guide?.sourceLinks?.length ? guide.sourceLinks : [];
}

function ImageStack({ character, imageUrl }: { character: AggregatedCharacter; imageUrl?: string }) {
  const images = characterImages(character.id || character.name);
  const sources = [
    imageUrl,
    character.images.portrait,
    character.images.gacha,
    character.images.card,
    images.portrait,
    images.gacha,
    images.card,
    character.images.icon,
    images.icon,
  ].filter(Boolean) as string[];

  return <AsyncImage src={sources} alt={character.name} className="character-portrait" fallback={character.name} />;
}

function RecommendationCard({ title, badge, note, imageSources }: { title: string; badge: string; note: string; imageSources?: string[] }) {
  return (
    <article className="player-recommendation">
      {imageSources?.length ? <AsyncImage src={imageSources} alt="" className="recommendation-image" /> : <div className="recommendation-image recommendation-image--empty"><Sparkles size={18} /></div>}
      <div className="player-recommendation__body">
        <div className="recommend-top"><strong>{title}</strong><span>{badge}</span></div>
        <p>{note}</p>
      </div>
    </article>
  );
}

export function CharacterPage() {
  const { id = '' } = useParams();
  const [character, setCharacter] = useState<AggregatedCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'build' | 'skills' | 'constellations' | 'materials'>('build');
  const [favorite, setFavorite] = useState(() => localStorage.getItem(`favorite:${id}`) === '1');
  const [materialChecks, setMaterialChecks] = useState<Record<string, boolean>>({});
  const [liveGuide, setLiveGuide] = useState<LivePlayerGuide | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setFavorite(localStorage.getItem(`favorite:${id}`) === '1');
    fetchAggregatedCharacter(id, controller.signal)
      .then(setCharacter)
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Unable to load this character.');
      })
      .finally(() => setLoading(false));
    fetchPlayerGuide(slugify(id), controller.signal)
      .then(setLiveGuide)
      .catch(() => setLiveGuide(null));
    return () => controller.abort();
  }, [id]);

  const guide = useMemo(() => {
    const fallback = character ? getGuide(character.id) ?? getGuide(character.name) : undefined;
    if (!liveGuide || liveGuide.source === 'Unavailable') return fallback;
    return { ...fallback, ...liveGuide, role: liveGuide.role.length ? liveGuide.role : fallback?.role ?? [], summary: liveGuide.summary || fallback?.summary || 'Current player build information.', talentPriority: liveGuide.talentPriority.length ? liveGuide.talentPriority : fallback?.talentPriority ?? [], statPriority: liveGuide.statPriority.length ? liveGuide.statPriority : fallback?.statPriority ?? [], weapons: liveGuide.weapons.length ? liveGuide.weapons : fallback?.weapons ?? [], artifacts: liveGuide.artifacts.length ? liveGuide.artifacts : fallback?.artifacts ?? [], teams: liveGuide.teams.length ? liveGuide.teams : fallback?.teams ?? [], mainStats: { ...fallback?.mainStats, ...liveGuide.mainStats }, caveats: fallback?.caveats, sourceLinks: [...(fallback?.sourceLinks ?? []), ...(liveGuide.sourceUrl ? [{ label: liveGuide.source, url: liveGuide.sourceUrl }] : [])] };
  }, [character, liveGuide]);

  if (loading) return <div className="detail-loading"><div className="skeleton-hero" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>;
  if (error || !character) return <div className="error-box"><h2>Character unavailable</h2><p>{error ?? 'No character data was returned.'}</p><Link to="/characters" className="button secondary">Back to character library</Link></div>;

  const raw = character.raw;
  const playerRaw = { ...raw, talents: character.secondary.talents ?? raw.talents, constellations: character.secondary.constellations ?? raw.constellations };
  const talents = extractTalents(playerRaw);
  const constellations = extractConstellations(playerRaw);
  const extractedMaterials = extractMaterials(playerRaw);
  const liveMaterialRefs = (liveGuide?.materials ?? []).map((material) => ({ ...material, source: material.source ?? liveGuide?.source }));
  const materials = [...extractedMaterials, ...liveMaterialRefs].filter((material, index, list) => list.findIndex((item) => item.name === material.name) === index);
  const statRows = baseStatRows(character.stats);
  const buildLinks = links(character.name);
  const guideSources = liveGuide?.sourceUrl ? [{ label: liveGuide.source, url: liveGuide.sourceUrl }] : sourceLinksForGuide(guide);
  const imageSet = characterImages(character.id || character.name);

  function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    localStorage.setItem(`favorite:${character!.id}`, next ? '1' : '0');
  }

  return <div className="character-page">
    <Link to="/characters" className="back-link">← Character library</Link>

    <section className={`character-hero ${String(character.element ?? '').toLowerCase()}`}>
      <div className="character-hero__art"><ImageStack character={character} imageUrl={liveGuide?.imageUrl} /></div>
      <div className="character-hero__copy">
        <div className="hero-meta">
          <span className={`element-chip large element-${(character.element ?? 'unknown').toLowerCase()}`}>{character.element ?? 'Unknown'}</span>
          <span>{character.weapon ?? 'Weapon'}</span>
          <span>{character.region ?? 'Teyvat'}</span>
          {character.rarity && <span className="gold-stars">{'★'.repeat(character.rarity)}</span>}
        </div>
        <div className="eyebrow">{character.title ?? 'Playable character'}</div>
        <h1>{character.name}</h1>
        <p>{character.description ?? 'Learn the character, recommended build, teams and materials in one place.'}</p>
        <div className="hero-actions">
          <button className={`button ${favorite ? 'primary' : 'secondary'}`} onClick={toggleFavorite}><Heart size={15} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? 'Saved' : 'Save Character'}</button>
          <button className="button secondary" onClick={() => setTab('build')}><Sparkles size={15} /> Build Guide</button>
        </div>
      </div>
    </section>

    <div className="character-quickfacts">
      <div><span>Role</span><strong>{guide?.role.join(' · ') ?? 'See build guide'}</strong></div>
      <div><span>Playstyle</span><strong>{guide?.summary ?? 'Explore the skills and stats below.'}</strong></div>
      <div><span>Talent focus</span><strong>{guide?.talentPriority.join(' → ') ?? 'Open Skills'}</strong></div>
    </div>

    <div className="tabs player-tabs">
      <button className={tab === 'build' ? 'tab active' : 'tab'} onClick={() => setTab('build')}>Build & Teams</button>
      <button className={tab === 'skills' ? 'tab active' : 'tab'} onClick={() => setTab('skills')}>Skills</button>
      <button className={tab === 'constellations' ? 'tab active' : 'tab'} onClick={() => setTab('constellations')}>Constellations</button>
      <button className={tab === 'materials' ? 'tab active' : 'tab'} onClick={() => setTab('materials')}>Materials</button>
    </div>

    {tab === 'build' && <div className="player-page-grid">
      <section className="panel player-panel">
        <SectionTitle eyebrow="RECOMMENDED BUILD" title="Build this character" description={guide?.summary ?? 'Current build data is loaded from the player-data sources.'} />
        {guide ? <>
          <div className="build-stat-grid player-build-summary">
            <div><span>Role</span><strong>{guide.role.join(' · ')}</strong></div>
            <div><span>Talent priority</span><strong>{guide.talentPriority.join(' → ')}</strong></div>
            <div><span>Substat priority</span><strong>{guide.statPriority.join(' → ')}</strong></div>
          </div>

          <div className="player-section-heading"><div><div className="eyebrow">ARTIFACTS</div><h3>Recommended artifact sets</h3></div></div>
          <div className="recommend-grid player-recommend-grid">
            {guide.artifacts.map((artifact) => <RecommendationCard key={`${artifact.set}-${artifact.pieces}`} title={artifact.set} badge={artifact.pieces} note={artifact.note} imageSources={[entityImage('artifacts', artifact.set, 'icon')]} />)}
          </div>

          <div className="main-stat-card">
            <div><span>Sands</span><strong>{guide.mainStats.sands}</strong></div>
            <div><span>Goblet</span><strong>{guide.mainStats.goblet}</strong></div>
            <div><span>Circlet</span><strong>{guide.mainStats.circlet}</strong></div>
          </div>

          <div className="player-section-heading"><div><div className="eyebrow">WEAPONS</div><h3>Recommended weapons</h3></div></div>
          <div className="recommend-grid player-recommend-grid">
            {guide.weapons.map((weapon) => <RecommendationCard key={weapon.name} title={weapon.name} badge={weapon.tier} note={weapon.note} imageSources={[entityImage('weapons', weapon.name, 'icon')]} />)}
          </div>

          {guide.caveats?.length ? <div className="build-notes"><strong>Build notes</strong>{guide.caveats.map((note) => <div key={note}><Check size={14} />{note}</div>)}</div> : null}
        </> : <div className="player-empty"><Sparkles size={20} /><div><strong>Build information is being prepared for this character.</strong><p>The game information below is still available, and maintained source guides are linked under Sources.</p></div></div>}
      </section>

      <section className="panel player-panel">
        <SectionTitle eyebrow="CHARACTER STATS" title="Progression" description="Base stats from the live game-data source." />
        <div className="stat-table-wrap"><table className="stat-table"><thead><tr><th>Level</th><th>HP</th><th>ATK</th><th>DEF</th><th>Bonus</th></tr></thead><tbody>{statRows.map((row) => <tr key={String(row.level)}><td>{String(row.level)}</td><td>{formatValue(row.hp)}</td><td>{formatValue(row.attack)}</td><td>{formatValue(row.defense)}</td><td>{formatValue(row.specialized)}</td></tr>)}</tbody></table></div>
        {!statRows.length && <div className="empty-state">Base stat progression is not available from the current data response.</div>}
      </section>

      <section className="panel player-panel player-panel--wide">
        <SectionTitle eyebrow="TEAM COMPOSITIONS" title="Recommended teams" description="Current team archetypes from the live build source." />
        {guide?.teams?.length ? <div className="team-guide-grid">{guide.teams.map((team) => <article className="team-guide-card" key={team.name}><div className="team-guide-card__title"><Swords size={17} /><h3>{team.name}</h3></div><div className="member-row">{team.members.length ? team.members.map((member) => <span className="member-pill" key={member}>{member}</span>) : <span className="member-pill">Team archetype</span>}</div><p>{team.note}</p>{team.source && <a href={team.source} target="_blank" rel="noreferrer" className="inline-source">Source <ExternalLink size={12} /></a>}</article>)}</div> : <div className="player-empty"><Swords size={20} /><div><strong>No maintained team guide is loaded for this character yet.</strong><p>Open the character guide source below for the current theorycrafting details.</p></div></div>}
      </section>

      <section className="panel player-panel player-panel--wide">
        <SectionTitle eyebrow="LEVELING" title="Materials & farming" description="Use the checklist to track the material references currently available for this character." />
        {materials.length ? <div className="material-table">{materials.map((material, index) => <label className="material-row player-material-row" key={`${material.name}-${index}`}><input type="checkbox" checked={materialChecks[material.name] ?? (localStorage.getItem(`material:${character.id}:${material.name}`) === '1')} onChange={(e) => { const checked = e.target.checked; setMaterialChecks((current) => ({ ...current, [material.name]: checked })); localStorage.setItem(`material:${character.id}:${material.name}`, checked ? '1' : '0'); }} /><span><strong>{material.name}</strong>{material.source && <small>{material.source}</small>}</span><strong>{material.amount ?? '—'}</strong><MapPin size={14} /></label>)}</div> : <div className="player-empty"><MapPin size={20} /><div><strong>Material totals are not available from this character response.</strong><p>Nothing is invented here; once the provider exposes the material structure, it can be shown directly in the planner.</p></div></div>}
      </section>

      <section className="panel player-panel player-panel--wide source-panel">
        <div className="source-panel__heading"><div><div className="eyebrow">SOURCES</div><h3>Where the recommendations come from</h3><p>Game facts and theorycrafting are kept separate so the player can see both without digging through developer data.</p></div></div>
        <div className="external-source-grid player-source-grid">{[...guideSources, ...buildLinks].filter((item, index, list) => list.findIndex((other) => other.url === item.url) === index).map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="source-button">{link.label}<ExternalLink size={13} /></a>)}</div>
      </section>
    </div>}

    {tab === 'skills' && <section className="panel player-panel"><SectionTitle eyebrow="TALENTS" title="Skills & abilities" description="Understand what each part of the kit does before investing resources." />{talents.length ? <div className="talent-detail-grid">{talents.map((talent, index) => <article className="talent-detail" key={`${talent.name}-${index}`}><div className="talent-index">{index + 1}</div><div><div className="eyebrow">{talent.type ?? 'Talent'}</div><h3>{talent.name}</h3><p>{talent.description ?? 'Description unavailable.'}</p></div></article>)}</div> : <div className="empty-state">Skill information is not available from the current data response.</div>}</section>}

    {tab === 'constellations' && <section className="panel player-panel"><SectionTitle eyebrow="CONSTELLATIONS" title="Constellations" description="See what changes at each constellation level before deciding whether you want to invest further." />{constellations.length ? <div className="constellation-list">{constellations.map((entry, index) => <article className="constellation-row" key={`${entry.name}-${index}`}><div className="constellation-number">C{entry.level ?? index + 1}</div><div><h3>{entry.name}</h3><p>{entry.description ?? 'Description unavailable.'}</p></div></article>)}</div> : <div className="empty-state">Constellation information is not available from the current data response.</div>}</section>}

    {tab === 'materials' && <section className="panel player-panel"><SectionTitle eyebrow="MATERIAL PLANNER" title={`${character.name} leveling materials`} description="Check off materials as you farm them." />{materials.length ? <div className="material-table">{materials.map((material, index) => <label className="material-row player-material-row" key={`${material.name}-${index}`}><input type="checkbox" checked={materialChecks[material.name] ?? false} onChange={(e) => { const checked = e.target.checked; setMaterialChecks((current) => ({ ...current, [material.name]: checked })); }} /><span><strong>{material.name}</strong>{material.category && <small>{material.category}</small>}</span><strong>{material.amount ?? '—'}</strong><MapPin size={14} /></label>)}</div> : <div className="player-empty"><MapPin size={20} /><div><strong>No material list was returned.</strong><p>The app will not fabricate material requirements when the data source does not provide them.</p></div></div>}</section>}
  </div>;
}
