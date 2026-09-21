import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchEntity, fetchFolderEntities } from '../api/genshinDb';
import { entityImage } from '../api/genshinDev';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import type { LibraryEntity } from '../types/genshin';

export function LibraryPage({ folder, title, eyebrow, description }: { folder: string; title: string; eyebrow: string; description: string }) {
  const [items, setItems] = useState<LibraryEntity[]>([]);
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('All');
  const [selected, setSelected] = useState<LibraryEntity | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const controller = new AbortController(); setLoading(true); fetchFolderEntities(folder, controller.signal).then(setItems).catch(() => setItems([])).finally(() => setLoading(false)); return () => controller.abort(); }, [folder]);
  const filtered = useMemo(() => items.filter((item) => (!search || `${item.name} ${item.type ?? ''} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase())) && (rarity === 'All' || String(item.rarity) === rarity)), [items, search, rarity]);
  async function open(item: LibraryEntity) { setSelected(item); try { const detail = await fetchEntity(folder, item.id || item.name); setSelected(detail); } catch { /* index data remains usable */ } }
  return <div><SectionTitle eyebrow={eyebrow} title={title} description={description} /><div className="toolbar"><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${folder}...`} /><select value={rarity} onChange={(e) => setRarity(e.target.value)}><option>All</option><option value="5">5★</option><option value="4">4★</option><option value="3">3★</option><option value="2">2★</option><option value="1">1★</option></select></div>{loading ? <div className="skeleton-grid">{Array.from({ length: 16 }).map((_, i) => <div className="skeleton-card compact" key={i} />)}</div> : <div className="entity-grid">{filtered.map((item) => <button className="entity-card" key={item.id} onClick={() => open(item)}><AsyncImage className="entity-icon" src={item.icon || entityImage(folder, item.id)} alt={item.name} fallback={item.name} /><div><strong>{item.name}</strong><span>{item.type ?? '—'} {item.rarity ? `· ${'★'.repeat(item.rarity)}` : ''}</span></div></button>)}</div>}{selected && <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}><aside className="drawer" onMouseDown={(e) => e.stopPropagation()}><button className="drawer-close" onClick={() => setSelected(null)}>×</button><AsyncImage src={selected.icon || entityImage(folder, selected.id)} alt={selected.name} className="drawer-image" fallback={selected.name} /><div className="eyebrow">{folder}</div><h2>{selected.name}</h2><p>{selected.description ?? 'No description was provided by the current data feed.'}</p><pre className="data-preview compact-preview">{JSON.stringify(selected.raw, null, 2)}</pre><Link className="button secondary" to={`/characters?search=${encodeURIComponent(selected.name)}`}>Find related characters</Link></aside></div>}</div>;
}
