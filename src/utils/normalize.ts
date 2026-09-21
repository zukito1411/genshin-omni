import type { GenshinCharacter, LibraryEntity } from '../types/genshin';

export function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function unwrapResult(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'result' in payload) return (payload as Record<string, unknown>).result;
  return payload;
}

export function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

export function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
  return [];
}

export function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

export function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return undefined;
}

export function normalizeCharacter(payload: unknown, idHint = ''): GenshinCharacter {
  const raw = asRecord(unwrapResult(payload));
  const images = asRecord(raw.images ?? raw.image ?? {});
  const name = firstString(raw.name, raw.displayName, idHint) ?? idHint;
  const id = firstString(raw.id, raw.key, raw.filename, raw.slug, idHint) ?? idHint;
  return {
    id,
    name,
    rarity: Number(raw.rarity ?? raw.stars ?? 0) || undefined,
    element: firstString(raw.element, raw.elemType, raw.elementType, raw.elementName),
    weapon: firstString(raw.weaponType, raw.weapon, raw.type),
    region: firstString(raw.region, raw.nation, raw.affiliation),
    birthday: firstString(raw.birthday, raw.birthdate),
    title: firstString(raw.title),
    description: firstString(raw.description, raw.desc),
    quote: firstString(raw.quote, raw.flavorText),
    images: {
      card: firstString(images.card, images.cardImage, images.gachaCard) ?? '',
      icon: firstString(images.icon, images.iconImage) ?? '',
      portrait: firstString(images.portrait, images.character) ?? '',
      gacha: firstString(images.gacha, images.gachaCard) ?? '',
    },
    raw,
  };
}

export function normalizeEntity(payload: unknown, idHint = ''): LibraryEntity {
  const raw = asRecord(unwrapResult(payload));
  return {
    id: firstString(raw.id, raw.key, raw.filename, raw.slug, idHint) ?? idHint,
    name: firstString(raw.name, raw.displayName, idHint) ?? idHint,
    rarity: Number(raw.rarity ?? raw.rank ?? 0) || undefined,
    type: firstString(raw.weaponType, raw.type, raw.itemType, raw.category),
    description: firstString(raw.description, raw.desc),
    icon: firstString(asRecord(raw.images).icon, raw.icon, raw.iconPath) ?? '',
    raw,
  };
}
