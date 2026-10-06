import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ListFilter } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { MaterialIcon } from '../components/MaterialIcon';
import { assetKey, characterImageSources } from '../api/genshinDev';
import { useCharacters } from '../hooks/useCharacters';
import { fetchEntity } from '../api/genshinDb';
import { fetchCharacterMaterials } from '../api/characterMaterials';
import { mapConcurrent } from '../utils/concurrency';
import { extractMaterials } from '../utils/genshin';
import { readMaterialChecks, writeMaterialChecks } from '../utils/playerData';
import type { GenshinCharacter, LibraryEntity, MaterialRef } from '../types/genshin';

const KEY = 'teyvat-atlas:material-selection';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type PlanMaterial = MaterialRef & { availability: string[]; entity?: LibraryEntity };
type Filter = 'all' | 'today' | 'remaining' | 'done';

function readIds(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

function extractAvailability(entity: LibraryEntity): string[] {
  const raw = entity.raw ?? {};
  const candidates = [raw.availability, raw.daysOfWeek, raw.daysofweek, raw.days, raw.weekdays, raw.weekday, raw.day];
  const flattened = candidates.flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,/|]/) : []);
  return [...new Set(flattened
    .map((value) => String(value).trim())
    .map((value) => WEEKDAYS.find((day) => day.toLowerCase() === value.toLowerCase() || day.slice(0, 3).toLowerCase() === value.slice(0, 3).toLowerCase()))
    .filter((value): value is string => Boolean(value)))];
}

async function loadAvailability(names: string[], signal: AbortSignal, onItem: (name: string, data: { availability: string[]; entity?: LibraryEntity }) => void) {
  await mapConcurrent(names, 3, async (name) => {
    let data: { availability: string[]; entity?: LibraryEntity } = { availability: [] };
    try {
      const entity = await fetchEntity('materials', name, signal);
      data = { availability: extractAvailability(entity), entity };
    } catch { /* Farming-day metadata is optional. */ }
    if (!signal.aborted) onItem(name, data);
  }, signal);
}

export function MaterialsPage() {
  const { allCharacters, loading } = useCharacters('');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(readIds);
  const [materials, setMaterials] = useState<PlanMaterial[]>([]);
  const [busy, setBusy] = useState(false);
  const planRequest = useRef<AbortController | null>(null);
  useEffect(() => () => planRequest.current?.abort(), []);
  const [built, setBuilt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const planKey = [...selectedIds].sort().join('|') || 'empty';
  const [checked, setChecked] = useState<string[]>(() => readMaterialChecks(planKey));
  const today = WEEKDAYS[new Date().getDay()];
  const visible = useMemo(() => allCharacters.filter((character) => !query || character.name.toLowerCase().includes(query.toLowerCase())).slice(0, 60), [allCharacters, query]);
  const selectedCharacters = useMemo(() => selectedIds.map((id) => allCharacters.find((character) => character.id === id)).filter((character): character is GenshinCharacter => Boolean(character)), [allCharacters, selectedIds]);

  function toggleCharacter(id: string) {
    if (busy) return;
    planRequest.current?.abort();
    const next = selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id].slice(-8);
    setSelectedIds(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Browser storage is optional. */ }
    const nextPlanKey = [...next].sort().join('|') || 'empty';
    setChecked(readMaterialChecks(nextPlanKey));
    setMaterials([]);
    setBuilt(false);
    setError(null);
  }

  function toggleMaterial(name: string) {
    const next = checked.includes(name) ? checked.filter((item) => item !== name) : [...checked, name];
    setChecked(next);
    writeMaterialChecks(planKey, next);
  }

  async function buildPlan() {
    planRequest.current?.abort();
    const controller = new AbortController();
    planRequest.current = controller;
    setBusy(true);
    setBuilt(true);
    setError(null);
    try {
      const loaded = await mapConcurrent(selectedCharacters, 2, (character) => fetchCharacterMaterials(character.name, controller.signal).catch(() => null), controller.signal);
      if (controller.signal.aborted) return;
      const total = new Map<string, MaterialRef>();
      loaded.filter(Boolean).forEach((character) => extractMaterials(character as Record<string, unknown>).forEach((item) => {
        const current = total.get(item.name);
        total.set(item.name, { ...item, amount: (current?.amount ?? 0) + (item.amount ?? 0) || undefined });
      }));
      if (!total.size) {
        setMaterials([]);
        setError('Material requirements are unavailable for this selection. Try a different character or choose Refresh latest data.');
        return;
      }
      const initial = [...total.values()].map((item) => ({ ...item, availability: [] })).sort((a, b) => a.name.localeCompare(b.name));
      // Show the checklist before optional farming-day metadata finishes loading.
      setMaterials(initial);
      setChecked(readMaterialChecks(planKey));
      void loadAvailability([...total.keys()], controller.signal, (name, data) => {
        setMaterials((current) => current.map((item) => item.name === name ? { ...item, ...data } : item));
      }).catch(() => undefined);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setMaterials([]);
      setError(reason instanceof Error ? reason.message : 'Unable to build this material checklist.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  const filteredMaterials = materials.filter((item) => {
    const complete = checked.includes(item.name);
    if (filter === 'today') return item.availability.includes(today);
    if (filter === 'remaining') return !complete;
    if (filter === 'done') return complete;
    return true;
  });
  const completedCount = materials.filter((item) => checked.includes(item.name)).length;

  return <div>
    <SectionTitle eyebrow="RESOURCE PLANNER" title="My Farming Plan" description="Choose up to eight characters, combine their material requirements, and keep a checklist on this device. Farming days are shown when available." />
    <div className="planner-layout">
      <section className="panel"><div className="toolbar"><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search characters" /></div>
        {selectedCharacters.length > 0 && <div className="selected-character-list">{selectedCharacters.map((character) => <button key={character.id} type="button" onClick={() => toggleCharacter(character.id)} disabled={busy}>{character.name} ×</button>)}</div>}
        {loading ? <div className="loading">Loading roster…</div> : <div className="material-character-list">{visible.map((character) => <label key={character.id} className={`material-character ${selectedIds.includes(character.id) ? 'selected' : ''}`}><input type="checkbox" checked={selectedIds.includes(character.id)} onChange={() => toggleCharacter(character.id)} disabled={busy} /><AsyncImage src={characterImageSources(character, 'icon')} alt="" className="planner-character-icon" assetKey={assetKey('characters', character.id)} /><span>{character.name}</span><small>{character.element}</small></label>)}</div>}
      </section>
      <section className="panel plan-output"><div className="plan-output-head"><div><div className="eyebrow">SELECTED</div><h3>{selectedCharacters.length} characters</h3></div><button className="button primary" onClick={buildPlan} disabled={!selectedCharacters.length || busy}>{busy ? 'Building checklist…' : 'Build checklist'}</button></div>
        {materials.length > 0 && <><div className="planner-progress"><Check size={15} /><span>{completedCount} of {materials.length} materials checked</span></div><div className="planner-filters" aria-label="Material checklist filters"><button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}><ListFilter size={14} /> All</button><button className={filter === 'today' ? 'active' : ''} type="button" onClick={() => setFilter('today')}><CalendarDays size={14} /> {today}</button><button className={filter === 'remaining' ? 'active' : ''} type="button" onClick={() => setFilter('remaining')}>Remaining</button><button className={filter === 'done' ? 'active' : ''} type="button" onClick={() => setFilter('done')}>Done</button></div>{filter === 'today' && <p className="muted planner-note">Items without provider-supplied availability are intentionally omitted from the daily view.</p>}<div className="material-table">{filteredMaterials.map((item) => <label className={`material-row farming-material-row ${checked.includes(item.name) ? 'checked' : ''}`} key={item.name}><input type="checkbox" checked={checked.includes(item.name)} onChange={() => toggleMaterial(item.name)} /><MaterialIcon name={item.name} entity={item.entity} icon={item.icon} /><span><strong>{item.name}</strong>{item.availability.length > 0 && <small>{item.availability.join(', ')}</small>}</span><strong>{item.amount ?? '—'}</strong><em>{item.category ?? ''}</em></label>)}</div>{!filteredMaterials.length && <div className="empty-state">No material in this plan matches the selected view.</div>}</>}
        {error && <div className="error-box"><strong>Checklist unavailable.</strong><p>{error}</p></div>}
        {!materials.length && !error && <div className="empty-state">{built ? 'No materials were returned for this selection.' : 'Select characters and build the checklist. Amounts stay “—” when a source does not provide a quantity.'}</div>}
      </section>
    </div>
  </div>;
}
