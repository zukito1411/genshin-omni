import { assetKey, materialImageSources } from '../api/genshinDev';
import type { LibraryEntity } from '../types/genshin';
import { AsyncImage } from './AsyncImage';

export function MaterialIcon({ name, entity, icon }: { name: string; entity?: LibraryEntity; icon?: string }) {
  return <AsyncImage src={materialImageSources(name, entity, icon)} alt="" className="material-icon" assetKey={assetKey('materials', name)} />;
}
