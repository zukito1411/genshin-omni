import { Boxes, Flower2, Gem, Image, Sparkles, Swords, UserRound } from 'lucide-react';

export type AssetKind = 'character' | 'weapon' | 'artifact' | 'material' | 'talent' | 'image';

export function AssetPlaceholder({ kind = 'image' }: { kind?: AssetKind }) {
  const Icon = { character: UserRound, weapon: Swords, artifact: Flower2, material: Gem, talent: Sparkles, image: Image }[kind] ?? Boxes;
  return <span className={`asset-placeholder asset-placeholder--${kind}`} aria-hidden="true"><Icon strokeWidth={1.4} /></span>;
}

export function assetKind(key?: string): AssetKind {
  if (key?.startsWith('characters:') || key?.startsWith('profile:')) return 'character';
  if (key?.startsWith('weapons:')) return 'weapon';
  if (key?.startsWith('artifacts:')) return 'artifact';
  if (key?.startsWith('materials:')) return 'material';
  if (key?.startsWith('talents:') || key?.startsWith('constellations:')) return 'talent';
  return 'image';
}
