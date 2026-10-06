import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { HeartPulse, Lightbulb, Save, ShieldCheck, Sparkles, Trash2, UsersRound } from 'lucide-react';
import { CharacterCard } from '../components/CharacterCard';
import { assetKey, characterImageSources, elementImageSources } from '../api/genshinDev';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { useCharacters } from '../hooks/useCharacters';
import type { GenshinCharacter } from '../types/genshin';

type TeamRole = '' | 'On-field DPS' | 'Off-field DPS' | 'Support' | 'Healer' | 'Shielder' | 'Flex';
interface SavedTeam { name: string; members: string[]; note: string; roles?: TeamRole[]; }
const KEY = 'teyvat-atlas:teams';
const ROLES: TeamRole[] = ['', 'On-field DPS', 'Off-field DPS', 'Support', 'Healer', 'Shielder', 'Flex'];

function readSaved(): SavedTeam[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function AsyncTeamImage({ character }: { character: GenshinCharacter }) {
  return <AsyncImage src={characterImageSources(character, 'icon')} alt={character.name} className="team-slot__image" assetKey={assetKey('characters', character.id || character.name)} />;
}

function reactionInsights(characters: GenshinCharacter[]) {
  const elements = new Set(characters.map((character) => String(character.element ?? '')));
  const pairs: Array<[string, string, string]> = [
    ['Pyro', 'Hydro', 'Vaporize'], ['Pyro', 'Cryo', 'Melt'], ['Pyro', 'Electro', 'Overload'],
    ['Hydro', 'Electro', 'Electro-Charged'], ['Hydro', 'Cryo', 'Freeze'], ['Hydro', 'Dendro', 'Bloom'],
    ['Dendro', 'Electro', 'Quicken / Aggravate / Spread'], ['Dendro', 'Pyro', 'Burning'],
  ];
  const reactions = pairs.filter(([first, second]) => elements.has(first) && elements.has(second)).map(([, , reaction]) => reaction);
  if (elements.has('Anemo') && ['Pyro', 'Hydro', 'Electro', 'Cryo'].some((element) => elements.has(element))) reactions.push('Swirl');
  if (elements.has('Geo') && ['Pyro', 'Hydro', 'Electro', 'Cryo'].some((element) => elements.has(element))) reactions.push('Crystallize');
  const resonance = [...elements].filter((element) => characters.filter((character) => character.element === element).length >= 2).map((element) => `${element} Resonance`);
  return { reactions, resonance };
}

export function TeamsPage() {
  const { allCharacters, loading } = useCharacters('');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selected, setSelected] = useState<(GenshinCharacter | null)[]>([null, null, null, null]);
  const [roles, setRoles] = useState<TeamRole[]>(['', '', '', '']);
  const [name, setName] = useState('My Team');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(readSaved);
  const [filter, setFilter] = useState('All');
  const elements = useMemo(() => ['All', ...Array.from(new Set(allCharacters.map((character) => character.element).filter(Boolean) as string[])).sort()], [allCharacters]);
  const pool = useMemo(() => allCharacters.filter((character) => (!deferredQuery || character.name.toLowerCase().includes(deferredQuery.toLowerCase())) && (filter === 'All' || character.element === filter)).slice(0, 60), [allCharacters, deferredQuery, filter]);
  const teamCharacters = selected.filter((character): character is GenshinCharacter => Boolean(character));
  const insights = reactionInsights(teamCharacters);
  const assignedRoles = roles.filter(Boolean);
  const onFieldCount = assignedRoles.filter((role) => role === 'On-field DPS').length;
  const hasSustain = assignedRoles.some((role) => role === 'Healer' || role === 'Shielder');

  const add = useCallback((character: GenshinCharacter) => {
    setSelected((current) => {
      if (current.some((slot) => slot?.id === character.id)) return current;
      const index = current.findIndex((slot) => slot === null);
      return index < 0 ? current : current.map((slot, slotIndex) => slotIndex === index ? character : slot);
    });
  }, []);
  function clearSlot(index: number) {
    setSelected((current) => current.map((slot, slotIndex) => slotIndex === index ? null : slot));
    setRoles((current) => current.map((role, roleIndex) => roleIndex === index ? '' : role));
  }
  function saveTeam() {
    // Compact members and roles together using their original slot indices.
    const team: SavedTeam = { name: name.trim() || 'My Team', note: note.trim(), members: teamCharacters.map((character) => character.id), roles: selected.flatMap((character, index) => character ? [roles[index]] : []) };
    if (!team.members.length) return;
    const next = [team, ...saved].slice(0, 20);
    setSaved(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  }
  function deleteTeam(index: number) {
    const next = saved.filter((_, teamIndex) => teamIndex !== index);
    setSaved(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  }

  return <div>
    <SectionTitle eyebrow="TEAMCRAFT" title="Interactive Team Builder" description="Build a four-character squad, assign the jobs you intend each member to perform, and review factual element interactions before saving it locally." />
    <section className="team-builder panel"><div className="team-slots">{selected.map((character, index) => <div className={`team-slot ${character ? 'filled' : ''}`} key={index}>{character ? <><AsyncTeamImage character={character} /><div><strong>{character.name}</strong><span>{elementImageSources(character.element).length > 0 && <img className="element-inline-icon" src={elementImageSources(character.element)[0]} alt="" />}{character.element} · {character.weapon}</span><select className="team-role-select" value={roles[index]} onChange={(event) => setRoles((current) => current.map((role, roleIndex) => roleIndex === index ? event.target.value as TeamRole : role))} aria-label={`${character.name} role`}>{ROLES.map((role) => <option key={role} value={role}>{role || 'Assign role'}</option>)}</select></div><button className="icon-button" onClick={() => clearSlot(index)} aria-label={`Remove ${character.name}`}>×</button></> : <div className="slot-empty"><UsersRound size={18} /> Slot {index + 1}</div>}</div>)}</div><div className="team-editor"><div><label>Team name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Notes<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Rotation, energy notes, role assignment…" /></label></div><button className="button primary" onClick={saveTeam}><Save size={15} /> Save team</button></div></section>
    <section className="team-insights panel"><div><div className="eyebrow">TEAM ADVISOR</div><h3>Potential interactions</h3><p>These are possible reactions based on elements present. Actual uptime, damage, and rotations depend on builds and player execution.</p></div><div className="team-insight-grid"><article><Sparkles size={18} /><strong>Reactions</strong><span>{insights.reactions.length ? insights.reactions.join(' · ') : 'Add compatible elements to reveal reactions.'}</span></article><article><ShieldCheck size={18} /><strong>Resonance</strong><span>{insights.resonance.length ? insights.resonance.join(' · ') : 'No double-element resonance yet.'}</span></article><article><HeartPulse size={18} /><strong>Role coverage</strong><span>{!teamCharacters.length ? 'Assign team members first.' : !assignedRoles.length ? 'Assign roles to check coverage.' : `${onFieldCount === 1 ? 'One on-field role assigned.' : onFieldCount > 1 ? `${onFieldCount} on-field roles may compete for field time.` : 'No on-field role assigned.'} ${hasSustain ? 'A sustain role is assigned.' : 'No healer or shielder is assigned.'}`}</span></article></div><div className="team-advisor-note"><Lightbulb size={15} /> Role feedback uses your labels instead of guessing from a scraped build page.</div></section>
    <section className="section-block"><SectionTitle eyebrow="CHARACTER PICKER" title="Add characters" /><div className="toolbar"><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by name" /><select value={filter} onChange={(event) => setFilter(event.target.value)}>{elements.map((element) => <option key={element}>{element}</option>)}</select></div>{loading ? <div className="loading">Loading character roster…</div> : <div className="character-grid compact-grid">{pool.map((character) => <CharacterCard key={character.id} character={character} selected={selected.some((item) => item?.id === character.id)} onSelect={add} />)}</div>}</section>
    <section className="section-block"><SectionTitle eyebrow="LOCAL SAVES" title="Saved teams" />{saved.length ? <div className="saved-team-grid">{saved.map((team, index) => <article className="panel saved-team" key={`${team.name}-${index}`}><div className="saved-team-head"><div><div className="eyebrow">TEAM</div><h3>{team.name}</h3></div><button className="icon-button danger" onClick={() => deleteTeam(index)} title="Delete"><Trash2 size={15} /></button></div><div className="member-row">{team.members.map((id, memberIndex) => <span className="member-pill" key={id}>{allCharacters.find((character) => character.id === id)?.name ?? id}{team.roles?.[memberIndex] && <small>{team.roles[memberIndex]}</small>}</span>)}</div><p>{team.note || 'No notes.'}</p></article>)}</div> : <div className="empty-state">No saved teams yet. Your saves stay in this browser on this device.</div>}</section>
  </div>;
}
