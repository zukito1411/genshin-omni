import type { EnkaAvatar, EnkaCharacterMetadata, EnkaMetadata, EnkaProfile, EnkaStat } from '../types/enka';
import { gameImageSources } from '../api/assets';

export const PROFILE_UID_KEY = 'teyvat-atlas:profile-uid:v1';
export const ARTIFACT_SLOTS = {
  EQUIP_BRACER: 'Flower', EQUIP_NECKLACE: 'Plume', EQUIP_SHOES: 'Sands',
  EQUIP_RING: 'Goblet', EQUIP_DRESS: 'Circlet',
};

export function savedUid(): string {
  try { return localStorage.getItem(PROFILE_UID_KEY) ?? ''; } catch { return ''; }
}

export function avatarId(avatar: EnkaAvatar): string {
  return String(avatar.avatarId ?? avatar.avatarID ?? '');
}

export function avatarKey(avatar: EnkaAvatar): string {
  return `${avatarId(avatar)}${avatar.skillDepotId ? `-${avatar.skillDepotId}` : ''}`;
}

export function avatarMetadata(avatar: EnkaAvatar, metadata?: EnkaMetadata | null): EnkaCharacterMetadata | undefined {
  return metadata?.characters[`${avatarId(avatar)}-${avatar.skillDepotId}`] ?? metadata?.characters[avatarId(avatar)];
}

export function enkaText(hash: string | number | undefined, metadata?: EnkaMetadata | null, fallback = 'Unknown item'): string {
  return hash === undefined ? fallback : metadata?.text[String(hash)] ?? fallback;
}

export function enkaImage(icon?: string): string[] {
  return gameImageSources(icon);
}

export function avatarImage(avatar: EnkaAvatar, metadata?: EnkaMetadata | null): string[] {
  const character = avatarMetadata(avatar, metadata);
  const costume = character?.Costumes?.[String(avatar.costumeId)]?.icon;
  return enkaImage(costume ?? character?.SideIconName?.replace('_Side_', '_'));
}

export function avatarArtwork(avatar: EnkaAvatar, metadata?: EnkaMetadata | null): string[] {
  const character = avatarMetadata(avatar, metadata);
  const costume = character?.Costumes?.[String(avatar.costumeId)];
  const icon = character?.SideIconName?.replace('_Side_', '_');
  const art = costume?.art ?? icon?.replace('UI_AvatarIcon_', 'UI_Gacha_AvatarImg_');
  return [...enkaImage(art), ...avatarImage(avatar, metadata)];
}

export function avatarElement(avatar: EnkaAvatar, metadata?: EnkaMetadata | null): string | undefined {
  const element = avatarMetadata(avatar, metadata)?.Element;
  return element ? ({ Ice: 'Cryo', Wind: 'Anemo', Electric: 'Electro', Water: 'Hydro', Fire: 'Pyro', Rock: 'Geo', Grass: 'Dendro' } as Record<string, string>)[element] ?? element : undefined;
}

export function profileImage(profile: EnkaProfile, metadata?: EnkaMetadata | null): string[] {
  const picture = profile.playerInfo.profilePicture;
  const custom = picture?.id ? metadata?.profilePictures?.[String(picture.id)]?.iconPath : undefined;
  return custom ? enkaImage(custom) : picture?.avatarId ? avatarImage({ avatarId: picture.avatarId, costumeId: picture.costumeId }, metadata) : [];
}

export function namecardImage(id?: number, metadata?: EnkaMetadata | null): string[] {
  return id ? enkaImage(metadata?.namecards?.[String(id)]?.icon) : [];
}

export function avatarName(avatar: EnkaAvatar, metadata?: EnkaMetadata | null): string {
  return enkaText(avatarMetadata(avatar, metadata)?.NameTextMapHash, metadata, `Character ${avatarId(avatar)}`);
}

export function avatarLevel(avatar: EnkaAvatar): string {
  const value = avatar.propMap?.['4001']?.val ?? avatar.propMap?.['4001']?.ival;
  return value === undefined ? '—' : String(value);
}

export function regionFromUid(uid: string): string {
  if (uid.length === 10 && uid.startsWith('18')) return 'Asia';
  return ({ '6': 'America', '7': 'Europe', '8': 'Asia', '9': 'TW / HK / MO', '1': 'Mainland China', '2': 'Mainland China', '5': 'Mainland China' } as Record<string, string>)[uid[0]] ?? 'Not available';
}

const STAT_NAMES: Record<string, string> = {
  FIGHT_PROP_BASE_ATTACK: 'Base ATK', FIGHT_PROP_HP: 'HP', FIGHT_PROP_ATTACK: 'ATK',
  FIGHT_PROP_DEFENSE: 'DEF', FIGHT_PROP_HP_PERCENT: 'HP', FIGHT_PROP_ATTACK_PERCENT: 'ATK',
  FIGHT_PROP_DEFENSE_PERCENT: 'DEF', FIGHT_PROP_CRITICAL: 'CRIT Rate',
  FIGHT_PROP_CRITICAL_HURT: 'CRIT DMG', FIGHT_PROP_CHARGE_EFFICIENCY: 'Energy Recharge',
  FIGHT_PROP_HEAL_ADD: 'Healing Bonus', FIGHT_PROP_ELEMENT_MASTERY: 'Elemental Mastery',
  FIGHT_PROP_PHYSICAL_ADD_HURT: 'Physical DMG Bonus', FIGHT_PROP_FIRE_ADD_HURT: 'Pyro DMG Bonus',
  FIGHT_PROP_ELEC_ADD_HURT: 'Electro DMG Bonus', FIGHT_PROP_WATER_ADD_HURT: 'Hydro DMG Bonus',
  FIGHT_PROP_WIND_ADD_HURT: 'Anemo DMG Bonus', FIGHT_PROP_ICE_ADD_HURT: 'Cryo DMG Bonus',
  FIGHT_PROP_ROCK_ADD_HURT: 'Geo DMG Bonus', FIGHT_PROP_GRASS_ADD_HURT: 'Dendro DMG Bonus',
};

export function equipmentStat(stat?: EnkaStat): { label: string; value: string } {
  const id = stat?.mainPropId ?? stat?.appendPropId ?? '';
  const percentage = /PERCENT|CRITICAL|CHARGE_EFFICIENCY|HEAL_ADD|ADD_HURT/.test(id);
  const value = stat?.propValue;
  return {
    label: STAT_NAMES[id] ?? (id ? id.replace('FIGHT_PROP_', '').replaceAll('_', ' ') : 'Stat'),
    // Equipment percentages are already expressed in percentage points by Enka.
    value: typeof value === 'number' && Number.isFinite(value)
      ? `${value.toLocaleString(undefined, { maximumFractionDigits: percentage ? 1 : 0 })}${percentage ? '%' : ''}` : '—',
  };
}

export const COMBAT_STATS: [string, string, boolean][] = [
  ['2000', 'Max HP', false], ['2001', 'ATK', false], ['2002', 'DEF', false],
  ['28', 'Elemental Mastery', false], ['20', 'CRIT Rate', true], ['22', 'CRIT DMG', true],
  ['23', 'Energy Recharge', true], ['26', 'Healing Bonus', true], ['27', 'Incoming Healing Bonus', true],
  ['30', 'Physical DMG Bonus', true], ['40', 'Pyro DMG Bonus', true], ['41', 'Electro DMG Bonus', true],
  ['42', 'Hydro DMG Bonus', true], ['43', 'Dendro DMG Bonus', true], ['44', 'Anemo DMG Bonus', true],
  ['45', 'Geo DMG Bonus', true], ['46', 'Cryo DMG Bonus', true], ['81', 'Shield Strength', true],
  ['80', 'Cooldown Reduction', true], ['29', 'Physical RES', true], ['50', 'Pyro RES', true],
  ['51', 'Electro RES', true], ['52', 'Hydro RES', true], ['53', 'Dendro RES', true],
  ['54', 'Anemo RES', true], ['55', 'Geo RES', true], ['56', 'Cryo RES', true],
];

export function combatValue(value: number | undefined, percent: boolean): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${(percent ? value * 100 : value).toLocaleString(undefined, { maximumFractionDigits: percent ? 1 : 0 })}${percent ? '%' : ''}` : '—';
}
