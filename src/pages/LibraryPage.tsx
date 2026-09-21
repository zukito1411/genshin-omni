import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { fetchEntity, fetchFolderEntities } from '../api/genshinDb';
import { assetKey, entityImageSources } from '../api/genshinDev';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import type { LibraryEntity } from '../types/genshin';

export function LibraryPage({ folder, title, eyebrow, description }: { folder: string; title: string; eyebrow: string; description: string }) {
  const [items, setItems] = useState<LibraryEntity[]>([]);
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('All');
  const [selected, setSelected] = useState<LibraryEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchFolderEntities(folder, controller.signal)
      .then(setItems)
      .catch((reason) => {
        if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : `Unable to load ${folder}.`);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [folder]);

  const filtered = useMemo(() => items.filter((item) =>
    (!search || `${item.name} ${item.type ?? ''} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase())) &&
    (rarity === 'All' || String(item.rarity) === rarity),
  ), [items, search, rarity]);

  async function open(item: LibraryEntity) {
    setSelected(item);
    if (item.description || Object.keys(item.raw).length > 3) return;
    try {
      const detail = await fetchEntity(folder, item.name);
      setSelected({ ...detail, icon: item.icon || detail.icon, raw: { ...detail.raw, ...item.raw } });
    } catch {
      // Keep the index data when the detailed request is unavailable.
    }
  }

  return <div>
    <SectionTitle eyebrow={eyebrow} title={title} description={description} />
    <div className="toolbar">
      <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${folder}...`} />
      <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
        <option>All</option><option value="5">5★</option><option value="4">4★</option><option value="3">3★</option><option value="2">2★</option><option value="1">1★</option>
      </select>
    </div>
    <div className="results-bar"><span>{loading ? 'Loading…' : `${filtered.length} entries`}</span><span className="muted">Browse the available library entries</span></div>
    {error && <div className="error-box"><strong>{eyebrow} data could not be loaded.</strong><p>{error}</p><p>Use Refresh latest data in the sidebar after a provider outage.</p></div>}
    {loading ? <div className="skeleton-grid">{Array.from({ length: 16 }).map((_, i) => <div className="skeleton-card compact" key={i} />)}</div> : <div className="entity-grid">{filtered.map((item) => <button className="entity-card" key={item.id || item.name} onClick={() => open(item)}>
      <AsyncImage className="entity-icon" src={entityImageSources(folder, item)} alt={item.name} assetKey={assetKey(folder, item.name)} />
      <div><strong>{item.name}</strong><span>{item.type ?? '—'} {item.rarity ? `· ${'★'.repeat(item.rarity)}` : ''}</span></div>
    </button>)}</div>}

    {selected && <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Close"><X size={18}/></button>
        <AsyncImage src={entityImageSources(folder, selected)} alt={selected.name} className="drawer-image" assetKey={assetKey(folder, selected.name)} />
        <div className="eyebrow">{selected.type ?? folder}</div>
        <h2>{selected.name}</h2>
        {selected.rarity && <div className="gold-stars">{'★'.repeat(selected.rarity)}</div>}
        {(selected.baseAttack || selected.secondaryStat || selected.secondaryValue) && <div className="build-stat-grid"><div><span>Base ATK (Lv. 1)</span><strong>{selected.baseAttack ?? 'N/A'}</strong></div><div><span>Secondary stat</span><strong>{selected.secondaryStat ?? 'N/A'}</strong></div><div><span>Value</span><strong>{selected.secondaryValue ?? 'N/A'}</strong></div></div>}
        {selected.effectName && <h3>{selected.effectName}</h3>}
        <p>{selected.description ?? 'No additional description was provided by the current public data source.'}</p>
        <a className="source-button" href={`https://genshin-db-api.vercel.app/`} target="_blank" rel="noreferrer">View data source <ExternalLink size={13}/></a>
      </aside>
    </div>}
  </div>;
}
