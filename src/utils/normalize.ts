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

function cleanElement(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/^ELEMENT_/i, '').replace(/^AVATAR_(ELEMENT_)?/i, '').trim() || undefined;
}

function cleanWeapon(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/^WEAPON_/i, '').replace(/^EQUIP_/i, '').trim() || undefined;
}

function filenameValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = text(value);
    if (result && !/^https?:\/\//i.test(result)) return result;
  }
  return undefined;
}

function imageFiles(images: Record<string, any>) {
  return {
    icon: filenameValue(images.filename_icon, images.iconFilename, images.iconPath, images.icon),
    iconCard: filenameValue(images.filename_iconCard, images.iconCardFilename, images.iconCard, images.card),
    sideIcon: filenameValue(images.filename_sideIcon, images.sideIconFilename, images.sideIcon),
    gachaSplash: filenameValue(images.filename_gachaSplash, images.gachaSplashFilename, images.gachaSplash),
    gachaSlice: filenameValue(images.filename_gachaSlice, images.gachaSliceFilename, images.gachaSlice),
  };
}

export function normalizeCharacter(payload: unknown, idHint = ''): GenshinCharacter {
  if (typeof payload === 'string') {
    const name = payload.trim();
    return { id: slugify(name || idHint), name: name || idHint, images: {}, raw: { name } };
  }

  const raw = asRecord(unwrapResult(payload));
  const images = asRecord(raw.images ?? raw.image ?? {});
  const name = firstString(raw.name, raw.displayName, raw.characterName, idHint) ?? idHint;
  const id = slugify(firstString(raw.key, raw.slug, raw.filename, raw.id, name, idHint) ?? name);
  const gameId = firstString(raw.id, raw.avatarId, raw.characterId);
  const files = imageFiles(images);

  return {
    id,
    gameId,
    name,
    rarity: Number(raw.rarity ?? raw.stars ?? raw.rank ?? (raw.qualityType === 'QUALITY_ORANGE' ? 5 : raw.qualityType === 'QUALITY_PURPLE' ? 4 : 0)) || undefined,
    element: cleanElement(firstString(raw.elementText, raw.element, raw.elemType, raw.elementName, raw.elementType)),
    weapon: cleanWeapon(firstString(raw.weaponText, raw.weapon, raw.weaponType, raw.type)),
    region: firstString(raw.region, raw.nation, raw.affiliation),
    birthday: firstString(raw.birthday, raw.birthdate),
    title: firstString(raw.title),
    description: firstString(raw.description, raw.desc, raw.descriptionText),
    quote: firstString(raw.quote, raw.flavorText),
    images: {
      image: firstString(images.image, images.imageUrl, images.cover1),
      card: firstString(images.card, images.cardImage, images.gachaCard),
      icon: firstString(images.icon, images.iconImage),
      portrait: firstString(images.portrait, images.character),
      gacha: firstString(images.gacha, images.gachaCard),
      mihoyoIcon: firstString(images.mihoyo_icon, images.mihoyoIcon),
      hoyowikiIcon: firstString(images.hoyowiki_icon, images.hoyowikiIcon),
      mihoyoSideIcon: firstString(images.mihoyo_sideIcon, images.mihoyoSideIcon),
      files,
    },
    raw,
  };
}

export function normalizeEntity(payload: unknown, idHint = ''): LibraryEntity {
  if (typeof payload === 'string') return { id: slugify(payload), name: payload, icon: '', raw: { name: payload } };
  const raw = asRecord(unwrapResult(payload));
  const images = asRecord(raw.images);
  const image = firstString(
    images.mihoyo_icon,
    images.icon,
    images.flower,
    images.mihoyo_flower,
    raw.icon,
    raw.iconPath,
    raw.nameicon,
    raw.nameIcon,
    raw.nameIconCard,
    raw.awakenIcon,
  ) ?? '';
  const effectText = [raw.effect2Pc, raw.effect4Pc, raw.effectName, raw.effectTemplateRaw]
    .map(text)
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .trim();
  return {
    id: slugify(firstString(raw.key, raw.slug, raw.filename, raw.id, idHint) ?? idHint),
    name: firstString(raw.name, raw.displayName, idHint) ?? idHint,
    rarity: Number(raw.rarity ?? raw.rank ?? (Array.isArray(raw.rarityList) ? Math.max(...raw.rarityList.map((value) => Number(value)).filter(Number.isFinite), 0) : 0)) || undefined,
    type: firstString(raw.weaponText, raw.relicText, raw.weaponType, raw.type, raw.itemType, raw.category),
    description: firstString(raw.description, raw.desc) ?? (effectText || undefined),
    icon: image,
    baseAttack: Math.round(Number(raw.baseAtkValue ?? raw.baseAttack ?? 0)) || undefined,
    secondaryStat: firstString(raw.mainStatText, raw.mainStatType),
    secondaryValue: firstString(raw.baseStatText, raw.mainStatValue),
    effectName: firstString(raw.effectName),
    twoPieceBonus: firstString(raw.effect2Pc),
    fourPieceBonus: firstString(raw.effect4Pc),
    raw,
  };
}
