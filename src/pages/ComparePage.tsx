import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ExternalLink } from 'lucide-react';
import { fetchAggregatedCharacter } from '../api/aggregator';
import { fetchPlayerGuide, type LivePlayerGuide } from '../api/playerGuide';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { assetKey, characterImageSources } from '../api/genshinDev';
import { useCharacters } from '../hooks/useCharacters';
import { baseStatRows, formatValue } from '../utils/genshin';
import type { AggregatedCharacter, GenshinCharacter } from '../types/genshin';

type ComparisonEntry = {
  character?: AggregatedCharacter;
  guide?: LivePlayerGuide;
  loading: boolean;
};

const emptyEntry: ComparisonEntry = { loading: false };

function CharacterSelect({
  label,
  value,
  onChange,
  characters,
  disabledId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  characters: GenshinCharacter[];
  disabledId: string;
}) {
  return <label className="compare-picker">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose a character</option>
      {characters.map((character) => (
        <option key={character.id} value={character.id} disabled={character.id === disabledId}>
          {character.name}
        </option>
      ))}
    </select>
  </label>;
}

function ComparisonColumn({ entry, side }: { entry: ComparisonEntry; side: string }) {
  if (!entry.character) {
    return <section className="panel compare-column compare-column--empty">
      <strong>{entry.loading ? 'Loading character data…' : `Choose the ${side.toLowerCase()} character`}</strong>
      <p>Stats and verified build recommendations will appear here.</p>
    </section>;
  }

  const { character, guide } = entry;
  const progression = baseStatRows(character.stats).at(-1);
  const sourceLinks = guide?.sourceLinks ?? [];

  return <section className="panel compare-column">
    <div className="compare-character-header">
      <div className={`compare-character-portrait rarity-${character.rarity ?? 0}`}><AsyncImage src={characterImageSources(character)} alt="" assetKey={assetKey('characters', character.id)} /></div>
      <div>
    <div className="eyebrow">{character.element ?? 'Unknown'} · {character.weapon ?? 'Weapon'}</div>
    <h2>{character.name}</h2>
    <p className="muted">{character.region ?? 'Teyvat'} · {character.rarity ? `${character.rarity}★` : 'Rarity unavailable'}</p>
      </div>
    </div>

    <div className="compare-stat-grid">
      <div><span>HP</span><strong>{progression ? formatValue(progression.hp) : '—'}</strong></div>
      <div><span>ATK</span><strong>{progression ? formatValue(progression.attack) : '—'}</strong></div>
      <div><span>DEF</span><strong>{progression ? formatValue(progression.defense) : '—'}</strong></div>
    </div>

    <div className="compare-section">
      <span>Role</span>
      <strong>{guide?.role.length ? guide.role.join(' · ') : entry.loading ? 'Loading…' : 'Not specified by the current guide'}</strong>
    </div>
    <div className="compare-section">
      <span>Talent priority</span>
      <strong>{guide?.talentPriority.length ? guide.talentPriority.join(' → ') : 'Not specified'}</strong>
    </div>
    <div className="compare-section">
      <span>Main stats</span>
      <strong>{guide ? [guide.mainStats.sands, guide.mainStats.goblet, guide.mainStats.circlet].filter(Boolean).join(' / ') || 'Not specified' : 'Loading…'}</strong>
    </div>
    <div className="compare-section">
      <span>Top weapon options</span>
      <strong>{guide?.weapons.slice(0, 3).map((weapon) => weapon.name).join(' · ') || 'Loading…'}</strong>
    </div>
    {sourceLinks.length > 0 && <div className="compare-sources">
      {sourceLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} <ExternalLink size={12} /></a>)}
    </div>}
  </section>;
}

export function ComparePage() {
  const { allCharacters, loading: rosterLoading } = useCharacters('');
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [left, setLeft] = useState<ComparisonEntry>(emptyEntry);
  const [right, setRight] = useState<ComparisonEntry>(emptyEntry);

  const byId = useMemo(() => new Map(allCharacters.map((character) => [character.id, character])), [allCharacters]);

  useEffect(() => {
    let active = true;
    const selected = byId.get(leftId);
    if (!selected) { setLeft(emptyEntry); return () => { active = false; }; }
    setLeft({ loading: true });
    void Promise.all([
      fetchAggregatedCharacter(selected.name),
      fetchPlayerGuide(selected.name).catch(() => undefined),
    ]).then(([character, guide]) => {
      if (active) setLeft({ character, guide, loading: false });
    }).catch(() => {
      if (active) setLeft({ loading: false });
    });
    return () => { active = false; };
  }, [leftId, byId]);

  useEffect(() => {
    let active = true;
    const selected = byId.get(rightId);
    if (!selected) { setRight(emptyEntry); return () => { active = false; }; }
    setRight({ loading: true });
    void Promise.all([
      fetchAggregatedCharacter(selected.name),
      fetchPlayerGuide(selected.name).catch(() => undefined),
    ]).then(([character, guide]) => {
      if (active) setRight({ character, guide, loading: false });
    }).catch(() => {
      if (active) setRight({ loading: false });
    });
    return () => { active = false; };
  }, [rightId, byId]);

  const swap = () => {
    setLeftId(rightId);
    setRightId(leftId);
  };

  return <div>
    <SectionTitle
      eyebrow="PLAYER TOOLS"
      title="Character Comparison"
      description="Compare base progression and the latest sourced build recommendations. Build guidance is shown as a reference, not a damage calculation."
    />
    <section className="panel compare-controls">
      <CharacterSelect label="Left character" value={leftId} onChange={setLeftId} characters={allCharacters} disabledId={rightId} />
      <button type="button" className="icon-button" onClick={swap} disabled={!leftId && !rightId} aria-label="Swap comparison characters"><ArrowLeftRight size={18} /></button>
      <CharacterSelect label="Right character" value={rightId} onChange={setRightId} characters={allCharacters} disabledId={leftId} />
    </section>
    {rosterLoading ? <div className="loading">Loading the character roster…</div> : <div className="compare-grid">
      <ComparisonColumn entry={left} side="left" />
      <ComparisonColumn entry={right} side="right" />
    </div>}
  </div>;
}
