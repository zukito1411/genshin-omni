import { memo } from 'react';
import { AsyncImage } from './AsyncImage';
import { assetKey, entityImageSources } from '../api/genshinDev';
import type { LibraryEntity } from '../types/genshin';

export const LibraryCard = memo(function LibraryCard({ item, folder, onOpen }: { item: LibraryEntity; folder: string; onOpen: (item: LibraryEntity) => void }) {
  return <button className={`entity-card rarity-${item.rarity ?? 0}`} onClick={() => onOpen(item)}>
    <AsyncImage className="entity-icon" src={entityImageSources(folder, item)} alt={item.name} assetKey={assetKey(folder, item.name)} />
    <div><strong>{item.name}</strong><span>{item.type ?? '—'}{' '}{item.rarity ? `· ${'★'.repeat(item.rarity)}` : ''}</span></div>
  </button>;
});
