import type { LibraryEntity } from '../types/genshin';
import { asRecord, firstString } from '../utils/normalize';
import { gameImageSources } from '../api/assets';
import { AsyncImage } from './AsyncImage';

const slots = ['flower', 'plume', 'sands', 'goblet', 'circlet'] as const;
const labels = ['Flower of Life', 'Plume of Death', 'Sands of Eon', 'Goblet of Eonothem', 'Circlet of Logos'];

/** Show only pieces supplied by the set's data, never inferred ownership. */
export function ArtifactPieces({ entity }: { entity: LibraryEntity }) {
  const images = asRecord(entity.raw.images);
  const pieces = slots.flatMap((slot, index) => {
    const piece = asRecord(entity.raw[slot]);
    const filename = firstString(images[`filename_${slot}`], piece.icon);
    const direct = firstString(images[slot], images[`mihoyo_${slot}`]);
    const name = firstString(piece.name);
    if (!name && !filename && !direct) return [];
    return [{ slot, label: labels[index], name, sources: [...gameImageSources(filename), ...(direct && /^https?:\/\//i.test(direct) ? [direct] : [])] }];
  });
  if (!pieces.length) return null;
  return <section className="drawer-section"><div className="eyebrow">SET PIECES</div><div className="artifact-piece-grid">{pieces.map((piece) => <article key={piece.slot} className={`artifact-piece rarity-${entity.rarity ?? 0}`}><AsyncImage src={piece.sources} alt="" assetKey={`artifacts:${entity.id}:${piece.slot}`} className="artifact-piece__image" /><span>{piece.label}</span><strong>{piece.name || entity.name}</strong></article>)}</div></section>;
}
