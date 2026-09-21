import { useMemo, useState } from 'react';
import { Save, Trash2, UsersRound } from 'lucide-react';
import { CharacterCard } from '../components/CharacterCard';
import { characterImages } from '../api/genshinDev';
import { SectionTitle } from '../components/SectionTitle';
import { useCharacters } from '../hooks/useCharacters';
import type { GenshinCharacter } from '../types/genshin';

interface SavedTeam { name: string; members: string[]; note: string; }
const KEY = 'teyvat-atlas:teams';
function readSaved(): SavedTeam[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } }

export function TeamsPage() {
  const { allCharacters, loading } = useCharacters('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<(GenshinCharacter | null)[]>([null, null, null, null]);
  const [name, setName] = useState('My Team');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(readSaved);
  const [filter, setFilter] = useState('All');
  const elements = useMemo(() => ['All', ...Array.from(new Set(allCharacters.map((c) => c.element).filter(Boolean) as string[])).sort()], [allCharacters]);
  const pool = allCharacters.filter((c) => (!query || c.name.toLowerCase().includes(query.toLowerCase())) && (filter === 'All' || c.element === filter)).slice(0, 60);
  function add(character: GenshinCharacter) { if (selected.some((slot) => slot?.id === character.id)) return; const next = [...selected]; const index = next.findIndex((slot) => slot === null); if (index >= 0) next[index] = character; setSelected(next); }
  function clearSlot(index: number) { setSelected((current) => current.map((slot, i) => i === index ? null : slot)); }
  function saveTeam() { const team: SavedTeam = { name: name.trim() || 'My Team', note: note.trim(), members: selected.filter(Boolean).map((c) => c!.id) }; if (!team.members.length) return; const next = [team, ...saved].slice(0, 20); setSaved(next); localStorage.setItem(KEY, JSON.stringify(next)); }
  function deleteTeam(index: number) { const next = saved.filter((_, i) => i !== index); setSaved(next); localStorage.setItem(KEY, JSON.stringify(next)); }
  return <div><SectionTitle eyebrow="TEAMCRAFT" title="Interactive Team Builder" description="Select up to four live character entries, save your teams locally, and use the character pages for current mechanics and community build references." />
    <section className="team-builder panel"><div className="team-slots">{selected.map((character, index) => <div className={`team-slot ${character ? 'filled' : ''}`} key={index}>{character ? <><img src={character.images.icon || characterImages(character.id || character.name).icon} alt="" onError={(e) => { e.currentTarget.style.display='none'; }} /><div><strong>{character.name}</strong><span>{character.element} · {character.weapon}</span></div><button className="icon-button" onClick={() => clearSlot(index)} aria-label={`Remove ${character.name}`}>×</button></> : <div className="slot-empty"><UsersRound size={18} /> Slot {index + 1}</div>}</div>)}</div><div className="team-editor"><div><label>Team name<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Notes<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rotation, energy notes, role assignment..." /></label></div><button className="button primary" onClick={saveTeam}><Save size={15} /> Save team</button></div></section>
    <section className="section-block"><SectionTitle eyebrow="CHARACTER PICKER" title="Add characters" /><div className="toolbar"><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name" /><select value={filter} onChange={(e) => setFilter(e.target.value)}>{elements.map((element) => <option key={element}>{element}</option>)}</select></div>{loading ? <div className="loading">Loading character roster…</div> : <div className="character-grid compact-grid">{pool.map((character) => <CharacterCard key={character.id} character={character} selected={selected.some((item) => item?.id === character.id)} onSelect={add} />)}</div>}</section>
    <section className="section-block"><SectionTitle eyebrow="LOCAL SAVES" title="Saved teams" />{saved.length ? <div className="saved-team-grid">{saved.map((team, index) => <article className="panel saved-team" key={`${team.name}-${index}`}><div className="saved-team-head"><div><div className="eyebrow">TEAM</div><h3>{team.name}</h3></div><button className="icon-button danger" onClick={() => deleteTeam(index)} title="Delete"><Trash2 size={15} /></button></div><div className="member-row">{team.members.map((id) => <span className="member-pill" key={id}>{allCharacters.find((character) => character.id === id)?.name ?? id}</span>)}</div><p>{team.note || 'No notes.'}</p></article>)}</div> : <div className="empty-state">No saved teams yet. Your saves stay in browser localStorage.</div>}</section>
  </div>;
}
