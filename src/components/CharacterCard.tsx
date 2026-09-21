import { Link } from 'react-router-dom';
import { assetKey, characterImageSources, elementImageSources } from '../api/genshinDev';
import type { GenshinCharacter } from '../types/genshin';
import { AsyncImage } from './AsyncImage';

const elementClass = (element?: string) => `element-${(element ?? 'unknown').toLowerCase()}`;

export function CharacterCard({ character, selected = false, onSelect }: { character: GenshinCharacter; selected?: boolean; onSelect?: (character: GenshinCharacter) => void }) {
  const routeKey = character.name || character.id;
  const imageSources = characterImageSources(character, 'card');
  const content = <>
    <div className="character-card__image-wrap">
      <AsyncImage src={imageSources} alt={character.name} className="character-card__image" assetKey={assetKey('characters', character.id || character.name)} />
      <span className={`element-chip ${elementClass(character.element)}`}>{elementImageSources(character.element).length > 0 && <img src={elementImageSources(character.element)[0]} alt="" />}{character.element ?? '?'}</span>
    </div>
    <div className="character-card__body">
      <div className="eyebrow">{character.weapon ?? 'Weapon'} · {character.region ?? 'Teyvat'}</div>
      <h3>{character.name}</h3>
      <div className="muted">{character.rarity ? '★'.repeat(character.rarity) : 'Rarity —'}</div>
    </div>
  </>;

  if (onSelect) return <button type="button" className={`character-card selectable ${selected ? 'selected' : ''}`} onClick={() => onSelect(character)}>{content}</button>;
  return <Link className="character-card" to={`/characters/${encodeURIComponent(routeKey)}`}>{content}</Link>;
}
