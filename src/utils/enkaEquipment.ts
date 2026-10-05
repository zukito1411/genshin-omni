import type { EnkaEquipment, EnkaMetadata, EnkaStat } from '../types/enka';
import { ARTIFACT_SLOTS, enkaText } from './enka';
import { artifactIconKey } from '../api/artifactNames';
import { bundledArtifactNames } from '../data/artifactNames';

const SLOT_IDS = Object.keys(ARTIFACT_SLOTS);
const PROP_IDS: Record<string, string> = {
  '2': 'FIGHT_PROP_HP', '3': 'FIGHT_PROP_HP_PERCENT', '4': 'FIGHT_PROP_BASE_ATTACK',
  '5': 'FIGHT_PROP_ATTACK', '6': 'FIGHT_PROP_ATTACK_PERCENT', '8': 'FIGHT_PROP_DEFENSE',
  '9': 'FIGHT_PROP_DEFENSE_PERCENT', '20': 'FIGHT_PROP_CRITICAL', '22': 'FIGHT_PROP_CRITICAL_HURT',
  '23': 'FIGHT_PROP_CHARGE_EFFICIENCY', '26': 'FIGHT_PROP_HEAL_ADD', '28': 'FIGHT_PROP_ELEMENT_MASTERY',
  '30': 'FIGHT_PROP_PHYSICAL_ADD_HURT', '40': 'FIGHT_PROP_FIRE_ADD_HURT', '41': 'FIGHT_PROP_ELEC_ADD_HURT',
  '42': 'FIGHT_PROP_WATER_ADD_HURT', '43': 'FIGHT_PROP_GRASS_ADD_HURT', '44': 'FIGHT_PROP_WIND_ADD_HURT',
  '45': 'FIGHT_PROP_ROCK_ADD_HURT', '46': 'FIGHT_PROP_ICE_ADD_HURT',
};
const validValue = (stat?: EnkaStat) => Number.isFinite(stat?.statValue ?? stat?.propValue);

function artifactDefinition(item: EnkaEquipment, metadata: EnkaMetadata | null) {
  const icon = item.flat?.icon || metadata?.relics?.Items?.[String(item.itemId)]?.Icon;
  const key = artifactIconKey(icon);
  return metadata?.artifactNames?.[key] ?? bundledArtifactNames[key];
}

function catalogStat(prop: string, value: number): EnkaStat | undefined {
  const id = PROP_IDS[prop];
  if (!id || !Number.isFinite(value)) return undefined;
  const percentage = /PERCENT|CRITICAL|CHARGE_EFFICIENCY|HEAL_ADD|ADD_HURT/.test(id);
  // Catalogs use fractions; the public flat equipment data uses percentage points.
  return { appendPropId: id, statValue: percentage ? value * 100 : value };
}

function weaponStats(item: EnkaEquipment, metadata: EnkaMetadata | null): EnkaStat[] {
  const data = metadata?.weapons?.[String(item.itemId)];
  const level = item.weapon?.level;
  if (!data || !level || !Number.isInteger(level)) return [];
  return Object.entries(data.BaseProps ?? {}).flatMap(([prop, base]) => {
    const curveId = data.PropGrowCurves?.[prop];
    const multiplier = curveId === undefined ? 1 : metadata?.curves?.[String(curveId)]?.[level - 1];
    const promotion = prop === '4' ? data.BasePromote?.[item.weapon?.promoteLevel ?? 0] : 0;
    if (multiplier === undefined || promotion === undefined) return [];
    const stat = catalogStat(prop, base * multiplier + promotion);
    return stat ? [stat] : [];
  });
}

function mergeStats(shared: EnkaStat[] = [], derived: EnkaStat[]): EnkaStat[] {
  const id = (stat: EnkaStat) => stat.mainPropId ?? stat.appendPropId ?? stat.appendPropID;
  return [...shared.map((stat) => validValue(stat) ? stat : derived.find((entry) => id(entry) === id(stat)) ?? stat),
    ...derived.filter((stat) => !shared.some((entry) => id(entry) === id(stat)))];
}

/** Resolve abbreviated snapshots from exact catalog IDs, levels, and substat rolls. */
export function resolveEquipment(item: EnkaEquipment, metadata: EnkaMetadata | null): EnkaEquipment {
  const flat = { ...item.flat };
  flat.nameTextMapHash ??= flat.nameTextHashMap;
  flat.setNameTextMapHash ??= flat.setNameTextHashMap;
  if (item.weapon || flat.itemType === 'ITEM_WEAPON') {
    const data = metadata?.weapons?.[String(item.itemId)];
    flat.nameTextMapHash ??= data?.NameTextMapHash;
    flat.rankLevel ??= data?.Rarity;
    flat.icon ??= data?.Icon;
    flat.weaponStats = mergeStats(flat.weaponStats, weaponStats(item, metadata));
    return { ...item, flat };
  }

  const data = metadata?.relics?.Items?.[String(item.itemId)];
  const definition = artifactDefinition(item, metadata);
  flat.rankLevel ??= data?.Rarity;
  flat.icon ??= data?.Icon;
  flat.equipType ??= data?.EquipType === undefined ? undefined : SLOT_IDS[data.EquipType];
  flat.equipType ??= definition?.equipType;
  flat.setNameTextMapHash ??= metadata?.relics?.Sets?.[String(data?.SetId)]?.Name;
  const main = flat.reliquaryMainstat;
  if (main && !validValue(main)) {
    const prop = Object.keys(PROP_IDS).find((key) => PROP_IDS[key] === main.mainPropId);
    const value = prop === undefined ? undefined : metadata?.relicLevels?.[String(flat.rankLevel)]?.[String(item.reliquary?.level)]?.[prop];
    const stat = value === undefined || prop === undefined ? undefined : catalogStat(prop, value);
    if (stat) flat.reliquaryMainstat = { mainPropId: main.mainPropId, statValue: stat.statValue };
  }
  const rolls = item.reliquary?.appendPropIdList?.map((id) => metadata?.affixes?.[String(id)]);
  // Do not display a partial sum as though it were a character's full substat.
  if (rolls?.length && rolls.every((roll) => roll && Number.isFinite(roll.Value))) {
    const totals = new Map<string, number>();
    for (const roll of rolls) {
      if (!roll) continue;
      const prop = String(roll.PropType);
      totals.set(prop, (totals.get(prop) ?? 0) + roll.Value);
    }
    const stats = [...totals].flatMap(([prop, value]) => {
      const stat = catalogStat(prop, value);
      return stat ? [stat] : [];
    });
    flat.reliquarySubstats = mergeStats(flat.reliquarySubstats, stats);
  }
  return { ...item, flat, resolvedName: definition?.name ?? item.resolvedName, resolvedSetName: definition?.setName ?? item.resolvedSetName };
}

export function equipmentName(item: EnkaEquipment, metadata: EnkaMetadata | null): string {
  const flat = item.flat;
  const name = item.resolvedName || enkaText(flat?.nameTextMapHash, metadata, '');
  if (name) return name;
  if (!item.weapon && flat?.itemType !== 'ITEM_WEAPON') {
    const set = equipmentSetName(item, metadata, '');
    const slot = ARTIFACT_SLOTS[flat?.equipType as keyof typeof ARTIFACT_SLOTS] ?? 'Artifact';
    if (set) return `${set} · ${slot}`;
  }
  if (item.weapon || flat?.itemType === 'ITEM_WEAPON') return 'Weapon name unavailable';
  const slot = ARTIFACT_SLOTS[flat?.equipType as keyof typeof ARTIFACT_SLOTS] ?? 'Artifact';
  return `${slot} name unavailable`;
}

export function equipmentSetName(item: EnkaEquipment, metadata: EnkaMetadata | null, fallback = 'Set name unavailable'): string {
  return enkaText(item.flat?.setNameTextMapHash, metadata, '') || item.resolvedSetName || fallback;
}
