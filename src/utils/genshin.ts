import { asArray, asRecord, firstString, text } from './normalize';
import type { ConstellationEntry, MaterialRef, TalentEntry } from '../types/genshin';

const candidate = (obj: Record<string, any>, keys: string[]) => keys.map((key) => obj[key]).find((value) => value !== undefined && value !== null);

export function extractTalents(raw: Record<string, unknown>): TalentEntry[] {
  const root = asRecord(raw);
  // Never merge arbitrary provider objects: some catalogue responses expose
  // numbered shells that look like talents but have no game description.
  const active = asArray(root.skillTalents).length ? asArray(root.skillTalents) : asArray(root.talents);
  const passive = asArray(root.passiveTalents);
  const values = [...active, ...passive];
  const seen = new Set<string>();
  return values.map((item, index) => {
    const obj = asRecord(item);
    const name = firstString(obj.name, obj.title);
    const description = firstString(obj.description, obj.desc, obj.detail, obj.effect, obj.descriptionText);
    return {
      name: name ?? '',
      type: firstString(obj.unlock, obj.type, obj.levelType, obj.kind),
      description,
      icon: firstString(obj.icon, asRecord(obj.images).icon),
      level: Number(obj.level ?? index + 1) || index + 1,
      raw: obj,
    } satisfies TalentEntry;
  }).filter((entry) => entry.name && entry.description && !seen.has(entry.name.toLowerCase()) && Boolean(seen.add(entry.name.toLowerCase())));
}

export function extractConstellations(raw: Record<string, unknown>): ConstellationEntry[] {
  const root = asRecord(raw);
  const values = asArray(candidate(root, ['constellations', 'constellationTalents', 'constellation']));
  return values.map((item, index) => {
    const obj = asRecord(item);
    const name = firstString(obj.name, obj.title);
    const description = firstString(obj.description, obj.desc, obj.effect, obj.descriptionText);
    return {
      name: name ?? '',
      description,
      level: Number(obj.level ?? index + 1) || index + 1,
      icon: firstString(obj.icon, asRecord(obj.images).icon),
    } satisfies ConstellationEntry;
  }).filter((entry) => entry.name && entry.description && entry.level && entry.level <= 6)
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
}

function materialFromObject(value: unknown, category?: string): MaterialRef | null {
  const obj = asRecord(value);
  const name = firstString(obj.name, obj.itemName, obj.material, obj.displayName, obj.label);
  if (!name) return null;

  // Genshin.jmp.blue uses { name, value } for ascension costs, whereas its
  // talent data also uses that same shape for combat-stat rows (for example
  // "1-Hit DMG: 44.5%"). Only an ascension record may use a bare `value`.
  // GenshinDB material records use explicit amount/quantity/count fields.
  const amountRaw = obj.amount ?? obj.quantity ?? obj.count ?? obj.value;
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
  const hasExplicitMaterialShape = obj.amount !== undefined || obj.quantity !== undefined || obj.count !== undefined || obj.material !== undefined || obj.itemName !== undefined;
  const hasAscensionValue = obj.value !== undefined && category === 'Ascension';
  if ((!hasExplicitMaterialShape && !hasAscensionValue) || !Number.isFinite(amount) || amount <= 0) return null;

  return {
    name,
    amount,
    icon: firstString(obj.icon, asRecord(obj.images).icon, obj.iconPath),
    source: firstString(obj.source, obj.obtain, obj.obtainMethod),
    category: firstString(obj.category, obj.type),
  };
}

export function extractMaterials(raw: Record<string, unknown>): MaterialRef[] {
  const totals = new Map<string, MaterialRef>();

  const add = (material: MaterialRef) => {
    const existing = totals.get(material.name);
    if (existing) {
      existing.amount = (existing.amount ?? 0) + (material.amount ?? 0) || existing.amount;
      existing.category = existing.category ?? material.category;
      existing.source = existing.source ?? material.source;
      existing.icon = existing.icon ?? material.icon;
      return;
    }
    totals.set(material.name, material);
  };

  const visit = (value: unknown, depth = 0, context = '', inheritedCategory?: string) => {
    if (depth > 10 || totals.size >= 160) return;

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1, context, inheritedCategory));
      return;
    }

    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    const category = /talent/i.test(context) ? 'Talent' : /ascension/i.test(context) ? 'Ascension' : inheritedCategory;

    const direct = materialFromObject(obj, category);
    if (direct) add({ ...direct, category: direct.category ?? category });

    // Talent objects contain numeric combat attributes and upgrade tables. They
    // are not material lists, so only descend through explicit material/cost
    // containers. This prevents skill rows such as "1-Hit DMG" from leaking
    // into the leveling checklist.
    const materialContext = /cost|material|ascension|items|item/i.test(context);
    Object.entries(obj).forEach(([key, child]) => {
      const isTechnical = /^(level|rank|id|type|category|name|description|source|obtain|amount|quantity|count|value)$/i.test(key);
      if (materialContext && !isTechnical) {
        if (typeof child === 'number' && Number.isFinite(child) && child > 0) {
          add({ name: key, amount: child, category });
          return;
        }
        if (typeof child === 'string' && /^\d+(?:\.\d+)?$/.test(child)) {
          const amount = Number(child);
          if (amount > 0) add({ name: key, amount, category });
          return;
        }
      }
      if (child && typeof child === 'object' && (/cost|material|ascension|items|item/i.test(key) || materialContext)) {
        const nextCategory = /talent/i.test(key) ? 'Talent' : /ascension/i.test(key) ? 'Ascension' : category;
        visit(child, depth + 1, key, nextCategory);
      }
    });
  };

  visit(raw);
  return [...totals.values()];
}

export function baseStatRows(stats: Record<string, unknown>): Array<Record<string, unknown>> {
  const map = stats && typeof stats === 'object' ? stats : {};
  // Show the standard level milestones only. Post-ascension `20+` etc. are
  // useful for calculation tools but duplicate this player-facing overview.
  return Object.entries(map).map(([level, row]) => ({ ...asRecord(row), level })).filter((row) => ['20', '40', '50', '60', '70', '80', '90'].includes(String(row.level)));
}

export function formatValue(value: unknown): string {
  if (typeof value === 'number') return new Intl.NumberFormat().format(value);
  if (typeof value === 'string') return value;
  return value == null ? '—' : JSON.stringify(value);
}

export function getStringArray(raw: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) return value.map(text).filter(Boolean) as string[];
  }
  return [];
}
