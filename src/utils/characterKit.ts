import { asRecord, firstString } from './normalize';
import { gameText } from './gameText';
import type { EnkaCharacterMetadata } from '../types/enka';

const talentTypes: Record<string, string> = { combat1: 'Normal Attack', combat2: 'Elemental Skill', combat3: 'Elemental Burst', combatsp: 'Alternate Sprint', passive1: 'Passive Talent', passive2: 'Passive Talent', passive3: 'Utility Passive' };

/** Flatten provider collections without losing their root-level icon metadata. */
export function combinedKitLists(keys: string[], ...sources: unknown[]): Record<string, unknown>[] {
  const entryPattern = keys.includes('constellations') ? /^c[1-6]$/i : /^(?:combat\d+|combatsp|passive\d+)$/i;
  const visit = (value: unknown, inheritedImages: Record<string, any> = {}, key = ''): Record<string, unknown>[] => {
    if (Array.isArray(value)) return value.flatMap((entry, index) => visit(entry, inheritedImages, String(index + 1)));
    const record = asRecord(value);
    const ownImages = asRecord(record.images);
    const images = { ...inheritedImages, ...ownImages };
    const name = gameText(firstString(record.name, record.title));
    const description = gameText(firstString(record.description, record.desc, record.detail, record.effect, record.descriptionText));
    // Root records also have a character name/description/artwork. They are
    // containers, not a talent, and must never swallow the actual kit below.
    const hasKitChildren = Object.keys(record).some((field) => keys.includes(field) || entryPattern.test(field) || (field === 'result' && typeof record[field] === 'object'));
    if (key && !hasKitChildren && name && (description || record.icon || Object.keys(ownImages).length)) {
      const entryKey = firstString(record.key, record.filename) ?? key;
      const constellationLevel = keys.includes('constellations')
        ? /^c([1-6])$/i.exec(entryKey)?.[1] ?? record.level ?? /^([1-6])$/.exec(entryKey)?.[1]
        : undefined;
      return [{
        ...record, name, description, key: entryKey,
        icon: firstString(record.icon, ownImages.filename_icon, ownImages.icon, images[`filename_${entryKey}`], images[entryKey]),
        ...(constellationLevel ? { level: Number(constellationLevel) } : {}),
        type: firstString(record.unlock, record.type, record.levelType, record.kind) ?? talentTypes[entryKey],
      }];
    }
    // Walk only kit containers and actual described records, never costs/stats.
    const entries = Object.entries(record);
    const ordered = [...keys.flatMap((container) => entries.filter(([childKey]) => childKey === container)), ...entries.filter(([childKey]) => !keys.includes(childKey))];
    return ordered.flatMap(([childKey, child]) => {
      if (childKey === 'images') return [];
      const item = asRecord(child);
      return childKey === 'result' || keys.includes(childKey) || entryPattern.test(childKey) || (firstString(item.name, item.title) && firstString(item.description, item.desc, item.effect, item.detail, item.descriptionText) && !/^(?:combat\d+|combatsp|passive\d+|c[1-6])$/i.test(childKey))
        ? visit(child, images, childKey) : [];
    });
  };
  const merged = new Map<string, Record<string, unknown>>();
  for (const entry of sources.flatMap((source) => visit(source))) {
    const key = String(entry.name).normalize('NFKC').toLowerCase();
    const previous = merged.get(key);
    // First (structured) source wins, but complementary providers fill blanks.
    merged.set(key, previous ? Object.fromEntries([...new Set([...Object.keys(entry), ...Object.keys(previous)])].map((field) => [field, previous[field] ?? entry[field]])) : entry);
  }
  return [...merged.values()];
}

const combatSlots: Record<string, number> = { combat1: 0, normalattack: 0, combat2: 1, elementalskill: 1, combat3: 2, elementalburst: 2 };
const combatSlot = (entry: Record<string, unknown>) => combatSlots[String(entry.key).toLowerCase()] ?? combatSlots[String(entry.type).replace(/[\s_-]/g, '').toLowerCase()];

export function needsKitArtwork(talents: Record<string, unknown>[], constellations: Record<string, unknown>[]): boolean {
  return talents.some((entry) => !entry.icon && combatSlot(entry) !== undefined) || constellations.some((entry) => !entry.icon && Number(entry.level) >= 1 && Number(entry.level) <= 6);
}

/** Fill only game-ID/slot-matched artwork; never guess icons from display names. */
export function fillKitArtwork(talents: Record<string, unknown>[], constellations: Record<string, unknown>[], metadata?: EnkaCharacterMetadata) {
  return {
    talents: talents.map((entry) => {
      const slot = combatSlot(entry);
      const skill = slot === undefined ? undefined : metadata?.SkillOrder?.[slot];
      return { ...entry, icon: entry.icon || (skill === undefined ? undefined : metadata?.Skills?.[String(skill)]) };
    }),
    constellations: constellations.map((entry) => ({ ...entry, icon: entry.icon || metadata?.Consts?.[Number(entry.level) - 1] })),
  };
}
