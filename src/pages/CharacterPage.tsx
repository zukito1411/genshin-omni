import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ExternalLink, Heart, MapPin, Sparkles, Swords } from 'lucide-react';
import { fetchAggregatedCharacter } from '../api/aggregator';
import { assetKey, characterImageSources, elementImageSources, entityImageSources, fetchGenshinBuildsAssetMap, findGenshinBuildsAsset, genshinBuildsImage } from '../api/genshinDev';
import { fetchEntity } from '../api/genshinDb';
import { fetchPlayerGuide, type LivePlayerGuide } from '../api/playerGuide';
import { AsyncImage } from '../components/AsyncImage';
import { SectionTitle } from '../components/SectionTitle';
import { slugify } from '../utils/normalize';
import { baseStatRows, extractConstellations, extractMaterials, extractTalents, formatValue } from '../utils/genshin';
import type { AggregatedCharacter, CharacterGuide, LibraryEntity } from '../types/genshin';

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

function catalogName(value: string): string {
  return value
    // Guides often annotate weapons with their refinement, e.g. "Favonius Sword (R5)"
    // or "Favonius Sword R5 100%". Those annotations are not part of the catalog name.
    .replace(/\s*(?:\(\s*R\s*\d+\s*\)|(?:\+\s*)?R\s*\d+)(?:\s+\d+(?:\.\d+)?%)?\s*$/i, '')
    .replace(/\s+(?:[24](?:-piece)?(?:\s*\+\s*[24](?:-piece)?)?|R\d+)\s*$/i, '')
    .trim();
}

function recommendationImageSources(folder: 'weapons' | 'artifacts', name: string, entity?: LibraryEntity, catalogImage?: string): string[] {
  const cleanName = catalogName(name);
  // The asset index powers the library page. Prefer its verified filename here too,
  // rather than guessing a filename from a guide's display label.
  return [catalogImage, genshinBuildsImage(folder, cleanName), ...entityImageSources(folder, entity ?? { name: cleanName, icon: '', raw: {} })].filter(Boolean) as string[];
}

function RecommendationCard({ title, badge, note, imageSources, onClick, folder }: { title: string; badge: string; note: string; imageSources?: string[]; onClick?: () => void; folder: 'weapons' | 'artifacts' }) {
  return (
    <article className={`player-recommendation ${onClick ? 'player-recommendation--interactive' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={(event) => { if (onClick && (event.key === 'Enter' || event.key === ' ')) onClick(); }}>
      {imageSources?.length ? <AsyncImage src={imageSources} alt="" className="recommendation-image" assetKey={assetKey(folder, catalogName(title))} /> : <div className="recommendation-image recommendation-image--empty">N/A</div>}
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
  const [guideLoading, setGuideLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'build' | 'skills' | 'constellations' | 'materials'>('build');
  const [favorite, setFavorite] = useState(() => localStorage.getItem(`favorite:${id}`) === '1');
  const [materialChecks, setMaterialChecks] = useState<Record<string, boolean>>({});
  const [liveGuide, setLiveGuide] = useState<LivePlayerGuide | null>(null);
  const [weaponEntities, setWeaponEntities] = useState<Record<string, LibraryEntity>>({});
  const [artifactEntities, setArtifactEntities] = useState<Record<string, LibraryEntity>>({});
  const [weaponAssets, setWeaponAssets] = useState<Record<string, string>>({});
  const [artifactAssets, setArtifactAssets] = useState<Record<string, string>>({});
  const [selectedRecommendation, setSelectedRecommendation] = useState<LibraryEntity | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setGuideLoading(true);
    setError(null);
    setCharacter(null);
    setLiveGuide(null);
    setWeaponEntities({});
    setArtifactEntities({});
    setWeaponAssets({});
    setArtifactAssets({});
    setFavorite(localStorage.getItem(`favorite:${id}`) === '1');

    fetchAggregatedCharacter(id, controller.signal)
      .then(setCharacter)
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Unable to load this character.');
      })
      .finally(() => setLoading(false));

    fetchPlayerGuide(slugify(id), controller.signal)
      .then(setLiveGuide)
      .catch(() => setLiveGuide(null))
      .finally(() => setGuideLoading(false));

    return () => controller.abort();
  }, [id]);

  const guide = useMemo<CharacterGuide | undefined>(() => liveGuide ? liveGuide : undefined, [liveGuide]);

  useEffect(() => {
    if (!liveGuide) return;
    const controller = new AbortController();
    const load = async () => {
      const [weaponEntries, artifactEntries, weaponAssetMap, artifactAssetMap] = await Promise.all([
        Promise.all(liveGuide.weapons.map(async (item) => {
        try { return [item.name, await fetchEntity('weapons', catalogName(item.name), controller.signal)] as const; } catch { return null; }
        })),
        Promise.all(liveGuide.artifacts.map(async (item) => {
        try { return [item.set, await fetchEntity('artifacts', catalogName(item.set), controller.signal)] as const; } catch { return null; }
        })),
        fetchGenshinBuildsAssetMap('weapons', controller.signal).catch(() => ({})),
        fetchGenshinBuildsAssetMap('artifacts', controller.signal).catch(() => ({})),
      ]);
      if (controller.signal.aborted) return;
      setWeaponEntities(Object.fromEntries(weaponEntries.filter((entry): entry is readonly [string, LibraryEntity] => Boolean(entry))));
      setArtifactEntities(Object.fromEntries(artifactEntries.filter((entry): entry is readonly [string, LibraryEntity] => Boolean(entry))));
      setWeaponAssets(weaponAssetMap);
      setArtifactAssets(artifactAssetMap);
    };
    load();
    return () => controller.abort();
  }, [liveGuide]);

  if (loading) return <div className="detail-loading"><div className="skeleton-hero" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>;
  if (error || !character) return <div className="error-box"><h2>Character unavailable</h2><p>{error ?? 'No character data was returned.'}</p><Link to="/characters" className="button secondary">Back to character library</Link></div>;

  const playerRaw = { ...character.raw, talents: character.secondary.talents ?? character.raw.talents, constellations: character.secondary.constellations ?? character.raw.constellations };
  const talents = extractTalents(playerRaw);
  const constellations = extractConstellations(playerRaw);
  const materials = extractMaterials(playerRaw);
  const statRows = baseStatRows(character.stats);
  const buildLinks = links(character.name);
  const guideSources = sourceLinksForGuide(guide);
  const imageSources = characterImageSources(character, 'portrait');
  const characterId = character.id;

  function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    localStorage.setItem(`favorite:${characterId}`, next ? '1' : '0');
  }

  return <div className="character-page">
    <Link to="/characters" className="back-link">← Character library</Link>

    <section className={`character-hero ${String(character.element ?? '').toLowerCase()}`}>
      <div className="character-hero__art"><AsyncImage src={imageSources} alt={character.name} className="character-portrait" assetKey={assetKey('characters', character.id || character.name)} /></div>
      <div className="character-hero__copy">
        <div className="hero-meta">
          <span className={`element-chip large element-${(character.element ?? 'unknown').toLowerCase()}`}>{elementImageSources(character.element).length > 0 && <img src={elementImageSources(character.element)[0]} alt="" />}{character.element ?? 'Unknown'}</span>
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
      <div><span>Role</span><strong>{guide?.role.join(' · ') || (guideLoading ? 'Loading build data…' : `${character.weapon ?? 'Character'} · ${character.element ?? 'Unknown'}`)}</strong></div>
      <div><span>Playstyle</span><strong>{guide?.summary || (guideLoading ? 'Loading current recommendations…' : 'Use the live character data below to understand this character.')}</strong></div>
      <div><span>Talent focus</span><strong>{guide?.talentPriority.join(' → ') || (guideLoading ? 'Loading…' : 'Open Skills')}</strong></div>
    </div>

    <div className="tabs player-tabs">
      <button className={tab === 'build' ? 'tab active' : 'tab'} onClick={() => setTab('build')}>Build & Teams</button>
      <button className={tab === 'skills' ? 'tab active' : 'tab'} onClick={() => setTab('skills')}>Skills</button>
      <button className={tab === 'constellations' ? 'tab active' : 'tab'} onClick={() => setTab('constellations')}>Constellations</button>
      <button className={tab === 'materials' ? 'tab active' : 'tab'} onClick={() => setTab('materials')}>Materials</button>
    </div>

    {tab === 'build' && <div className="player-page-grid">
      <section className="panel player-panel">
        <SectionTitle eyebrow="RECOMMENDED BUILD" title="Build this character" description={guide?.summary ?? (guideLoading ? 'Loading maintained player build sources…' : 'No public build source is currently available for this character; the game data below remains available.')} />
        {guide ? <>
          <div className="build-stat-grid player-build-summary">
            <div><span>Role</span><strong>{guide.role.length ? guide.role.join(' · ') : 'Not stated by source'}</strong></div>
            <div><span>Talent priority</span><strong>{guide.talentPriority.length ? guide.talentPriority.join(' → ') : 'See Skills'}</strong></div>
            <div><span>Substat priority</span><strong>{guide.statPriority.length ? guide.statPriority.join(' → ') : 'See main stats below'}</strong></div>
          </div>

          <div className="player-section-heading"><div><div className="eyebrow">ARTIFACTS</div><h3>Recommended artifact sets</h3></div></div>
          <div className="recommend-grid player-recommend-grid">
            {guide.artifacts.length ? guide.artifacts.map((artifact) => <RecommendationCard key={`${artifact.set}-${artifact.pieces}`} folder="artifacts" title={artifact.set} badge={artifact.pieces} note={artifact.note} imageSources={recommendationImageSources('artifacts', artifact.set, artifactEntities[artifact.set], findGenshinBuildsAsset(artifactAssets, catalogName(artifact.set)))} onClick={artifactEntities[artifact.set] ? () => setSelectedRecommendation(artifactEntities[artifact.set]) : undefined} />) : <div className="player-empty"><strong>Artifact recommendations were not returned.</strong><p>The character facts are still available; the page will not invent a build.</p></div>}
          </div>

          <div className="main-stat-card">
            <div><span>Sands</span><strong>{guide.mainStats.sands || '—'}</strong></div>
            <div><span>Goblet</span><strong>{guide.mainStats.goblet || '—'}</strong></div>
            <div><span>Circlet</span><strong>{guide.mainStats.circlet || '—'}</strong></div>
          </div>

          <div className="player-section-heading"><div><div className="eyebrow">WEAPONS</div><h3>Recommended weapons</h3></div></div>
          <div className="recommend-grid player-recommend-grid">
            {guide.weapons.length ? guide.weapons.map((weapon) => <RecommendationCard key={weapon.name} folder="weapons" title={weapon.name} badge={weapon.tier} note={weapon.note} imageSources={recommendationImageSources('weapons', weapon.name, weaponEntities[weapon.name], findGenshinBuildsAsset(weaponAssets, catalogName(weapon.name)))} onClick={weaponEntities[weapon.name] ? () => setSelectedRecommendation(weaponEntities[weapon.name]) : undefined} />) : <div className="player-empty"><strong>Weapon recommendations were not returned.</strong><p>The character facts are still available; the page will not invent a build.</p></div>}
          </div>
        </> : <div className="player-empty"><Sparkles size={20} /><div><strong>{guideLoading ? 'Loading the latest player build information…' : 'No public build source is currently available.'}</strong><p>{guideLoading ? 'Teyvat Atlas is checking multiple public build sources for this character.' : 'The live game data, skills, constellations and materials are still available on this page.'}</p></div></div>}
      </section>

      <section className="panel player-panel">
        <SectionTitle eyebrow="CHARACTER STATS" title="Progression" description="Base stats from the live game-data source." />
        <div className="stat-table-wrap"><table className="stat-table"><thead><tr><th>Level</th><th>HP</th><th>ATK</th><th>DEF</th><th>Bonus</th></tr></thead><tbody>{statRows.map((row) => <tr key={`${String(row.level)}-${String(row.hp)}`}><td>{String(row.level)}</td><td>{formatValue(row.hp)}</td><td>{formatValue(row.attack)}</td><td>{formatValue(row.defense)}</td><td>{formatValue(row.specialized)}</td></tr>)}</tbody></table></div>
        {!statRows.length && <div className="empty-state">Base stat progression is not available from the current data response.</div>}
      </section>

      <section className="panel player-panel player-panel--wide">
        <SectionTitle eyebrow="TEAM COMPOSITIONS" title="Recommended teams" description="Team recommendations gathered from the current public build sources." />
        {guide?.teams?.length ? <div className="team-guide-grid">{guide.teams.map((team) => <article className="team-guide-card" key={team.name}><div className="team-guide-card__title"><Swords size={17} /><h3>{team.name}</h3></div><div className="member-row">{team.members.length ? team.members.map((member) => <span className="member-pill" key={member}>{member}</span>) : <span className="member-pill">{team.name}</span>}</div><p>{team.note}</p>{team.source && <a href={team.source} target="_blank" rel="noreferrer" className="inline-source">Source <ExternalLink size={12} /></a>}</article>)}</div> : <div className="player-empty"><Swords size={20} /><div><strong>{guideLoading ? 'Loading team recommendations…' : 'No team recommendations were returned by the checked sources.'}</strong><p>{guideLoading ? 'Teyvat Atlas is checking multiple maintained sources.' : 'No team is being fabricated when the sources do not provide one.'}</p></div></div>}
      </section>

      <section className="panel player-panel player-panel--wide">
        <SectionTitle eyebrow="LEVELING" title="Materials & farming" description="Exact material totals are taken from the live character data and can be checked against the map." />
        {materials.length ? <div className="material-table">{materials.map((material, index) => <label className="material-row player-material-row" key={`${material.name}-${index}`}><input type="checkbox" checked={materialChecks[material.name] ?? (localStorage.getItem(`material:${character.id}:${material.name}`) === '1')} onChange={(e) => { const checked = e.target.checked; setMaterialChecks((current) => ({ ...current, [material.name]: checked })); localStorage.setItem(`material:${character.id}:${material.name}`, checked ? '1' : '0'); }} /><span><strong>{material.name}</strong>{material.category && <small>{material.category}</small>}</span><strong>{material.amount ?? '—'}</strong><a className="material-map-link" href={`https://genshin-impact-map.appsample.com/location?names=${encodeURIComponent(material.name)}`} target="_blank" rel="noreferrer" title={`Find ${material.name} on the map`}><MapPin size={14} /></a></label>)}</div> : <div className="player-empty"><MapPin size={20} /><div><strong>Material totals are not available from this character response.</strong><p>The app does not invent requirements.</p></div></div>}
      </section>

      <section className="panel player-panel player-panel--wide source-panel">
        <div className="source-panel__heading"><div><div className="eyebrow">SOURCES</div><h3>Where this page gets its information</h3><p>Game data and player build references are shown separately so the recommendations remain traceable.</p></div></div>
        <div className="external-source-grid player-source-grid">{[...guideSources, ...buildLinks].filter((item, index, list) => list.findIndex((other) => other.url === item.url) === index).map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="source-button">{link.label}<ExternalLink size={13} /></a>)}</div>
      </section>
    </div>}

    {tab === 'skills' && <section className="panel player-panel"><SectionTitle eyebrow="TALENTS" title="Skills & abilities" description="Understand what each part of the kit does before investing resources." />{talents.length ? <div className="talent-detail-grid">{talents.map((talent, index) => <article className="talent-detail" key={`${talent.name}-${index}`}><div className="talent-index">{index + 1}</div><div><div className="eyebrow">{talent.type ?? 'Talent'}</div><h3>{talent.name}</h3><p>{talent.description ?? 'Description unavailable.'}</p></div></article>)}</div> : <div className="empty-state">Skill information is not available from the current data response.</div>}</section>}

    {tab === 'constellations' && <section className="panel player-panel"><SectionTitle eyebrow="CONSTELLATIONS" title="Constellations" description="See what changes at each constellation level before deciding whether you want to invest further." />{constellations.length ? <div className="constellation-list">{constellations.map((entry, index) => <article className="constellation-row" key={`${entry.name}-${index}`}><div className="constellation-number">C{entry.level ?? index + 1}</div><div><h3>{entry.name}</h3><p>{entry.description ?? 'Description unavailable.'}</p></div></article>)}</div> : <div className="empty-state">Constellation information is not available from the current data response.</div>}</section>}

    {tab === 'materials' && <section className="panel player-panel"><SectionTitle eyebrow="MATERIAL PLANNER" title={`${character.name} leveling materials`} description="Check off materials as you farm them." />{materials.length ? <div className="material-table">{materials.map((material, index) => <label className="material-row player-material-row" key={`${material.name}-${index}`}><input type="checkbox" checked={materialChecks[material.name] ?? false} onChange={(e) => { const checked = e.target.checked; setMaterialChecks((current) => ({ ...current, [material.name]: checked })); }} /><span><strong>{material.name}</strong>{material.category && <small>{material.category}</small>}</span><strong>{material.amount ?? '—'}</strong><a className="material-map-link" href={`https://genshin-impact-map.appsample.com/location?names=${encodeURIComponent(material.name)}`} target="_blank" rel="noreferrer" title={`Find ${material.name} on the map`}><MapPin size={14} /></a></label>)}</div> : <div className="player-empty"><MapPin size={20} /><div><strong>No material list was returned.</strong><p>The live source does not currently expose material requirements for this character.</p></div></div>}</section>}

    {selectedRecommendation && <div className="drawer-backdrop" onMouseDown={() => setSelectedRecommendation(null)}><aside className="drawer recommendation-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="drawer-close" onClick={() => setSelectedRecommendation(null)} aria-label="Close"><Check size={18} /></button><AsyncImage src={entityImageSources(selectedRecommendation.baseAttack ? 'weapons' : 'artifacts', selectedRecommendation)} alt={selectedRecommendation.name} className="drawer-image" assetKey={assetKey(selectedRecommendation.baseAttack ? 'weapons' : 'artifacts', selectedRecommendation.name)} /><div className="eyebrow">{selectedRecommendation.type ?? 'REFERENCE'}</div><h2>{selectedRecommendation.name}</h2>{selectedRecommendation.rarity && <div className="gold-stars">{'★'.repeat(selectedRecommendation.rarity)}</div>}{selectedRecommendation.baseAttack && <div className="build-stat-grid"><div><span>Base ATK (Lv. 1)</span><strong>{selectedRecommendation.baseAttack}</strong></div><div><span>Secondary stat</span><strong>{selectedRecommendation.secondaryStat ?? 'N/A'}</strong></div><div><span>Value</span><strong>{selectedRecommendation.secondaryValue ?? 'N/A'}</strong></div></div>}{selectedRecommendation.effectName && <h3>{selectedRecommendation.effectName}</h3>}{selectedRecommendation.twoPieceBonus && <p><strong>2-piece:</strong> {selectedRecommendation.twoPieceBonus}</p>}{selectedRecommendation.fourPieceBonus && <p><strong>4-piece:</strong> {selectedRecommendation.fourPieceBonus}</p>}{!selectedRecommendation.twoPieceBonus && !selectedRecommendation.fourPieceBonus && <p>{selectedRecommendation.description ?? 'No additional information was returned.'}</p>}</aside></div>}
  </div>;
}
