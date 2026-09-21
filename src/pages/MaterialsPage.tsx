import { useMemo, useState } from 'react';
import { SectionTitle } from '../components/SectionTitle';
import { useCharacters } from '../hooks/useCharacters';
import { fetchCharacter } from '../api/genshinDb';
import { extractMaterials } from '../utils/genshin';
import type { GenshinCharacter, MaterialRef } from '../types/genshin';

const KEY = 'teyvat-atlas:material-selection';
function readIds(): string[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } }

export function MaterialsPage() {
  const { allCharacters, loading } = useCharacters('');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(readIds);
  const [materials, setMaterials] = useState<MaterialRef[]>([]);
  const [busy, setBusy] = useState(false);
  const visible = useMemo(() => allCharacters.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 60), [allCharacters, query]);
  function toggle(id: string) { const next = selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id].slice(-8); setSelectedIds(next); localStorage.setItem(KEY, JSON.stringify(next)); }
  async function buildPlan() { setBusy(true); try { const loaded = await Promise.all(selectedIds.map((id) => fetchCharacter(id).catch(() => null))); const map = new Map<string, MaterialRef>(); loaded.filter(Boolean).forEach((character) => extractMaterials((character as GenshinCharacter).raw).forEach((item) => { const current = map.get(item.name); map.set(item.name, { ...item, amount: (current?.amount ?? 0) + (item.amount ?? 0) || undefined }); })); setMaterials([...map.values()].sort((a,b) => a.name.localeCompare(b.name))); } finally { setBusy(false); } }
  return <div><SectionTitle eyebrow="RESOURCE PLANNER" title="Character Material Planner" description="Pick characters, then aggregate material objects directly from the current GenshinDB responses. No hard-coded totals are displayed when the provider does not expose a quantity." />
    <div className="planner-layout"><section className="panel"><div className="toolbar"><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search characters" /></div>{loading ? <div className="loading">Loading roster…</div> : <div className="material-character-list">{visible.map((character) => <label key={character.id} className={`material-character ${selectedIds.includes(character.id) ? 'selected' : ''}`}><input type="checkbox" checked={selectedIds.includes(character.id)} onChange={() => toggle(character.id)} /><span>{character.name}</span><small>{character.element}</small></label>)}</div>}</section><section className="panel plan-output"><div className="plan-output-head"><div><div className="eyebrow">SELECTED</div><h3>{selectedIds.length} characters</h3></div><button className="button primary" onClick={buildPlan} disabled={!selectedIds.length || busy}>{busy ? 'Building…' : 'Build checklist'}</button></div>{materials.length ? <div className="material-table">{materials.map((item) => <label className="material-row" key={item.name}><input type="checkbox" /><span>{item.name}</span><strong>{item.amount ?? '—'}</strong><em>{item.category ?? ''}</em></label>)}</div> : <div className="empty-state">Select characters and build the checklist. Quantities remain “—” when the upstream payload does not provide a numeric amount.</div>}</section></div>
  </div>;
}
