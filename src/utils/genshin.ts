import { asArray, asRecord, firstString, text } from './normalize';
import type { ConstellationEntry, MaterialRef, TalentEntry } from '../types/genshin';

const candidate = (obj: Record<string, any>, keys: string[]) => keys.map((key) => obj[key]).find((value) => value !== undefined && value !== null);

export function extractTalents(raw: Record<string, unknown>): TalentEntry[] {
  const root = asRecord(raw);
  const values = asArray(candidate(root, ['talents', 'skills', 'abilities', 'talent']));
  return values.map((item, index) => {
    const obj = asRecord(item);
    return {
      name: firstString(obj.name, obj.title, obj.type, `Talent ${index + 1}`) ?? `Talent ${index + 1}`,
      type: firstString(obj.type, obj.levelType, obj.kind),
      description: firstString(obj.description, obj.desc, obj.detail, obj.effect),
      icon: firstString(obj.icon, asRecord(obj.images).icon),
      level: Number(obj.level ?? index + 1) || index + 1,
      raw: obj,
    } satisfies TalentEntry;
  }).filter((entry) => entry.name);
}

export function extractConstellations(raw: Record<string, unknown>): ConstellationEntry[] {
  const root = asRecord(raw);
  const values = asArray(candidate(root, ['constellations', 'constellation']));
  return values.map((item, index) => {
    const obj = asRecord(item);
    return {
      name: firstString(obj.name, obj.title, `C${index + 1}`) ?? `C${index + 1}`,
      description: firstString(obj.description, obj.desc, obj.effect),
      level: Number(obj.level ?? index + 1) || index + 1,
      icon: firstString(obj.icon, asRecord(obj.images).icon),
    } satisfies ConstellationEntry;
  });
}

function materialFromObject(value: unknown): MaterialRef | null {
  const obj = asRecord(value);
  const name = firstString(obj.name, obj.itemName, obj.material, obj.displayName, obj.label);
  if (!name) return null;
  const amountRaw = obj.amount ?? obj.quantity ?? obj.count;
  const hasMaterialShape = amountRaw !== undefined || obj.material !== undefined || obj.itemName !== undefined;
  if (!hasMaterialShape) return null;
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
  return {
    name,
    amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
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
      value.forEach((item) => visit(item, depth + 1, context));
      return;
    }

    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    const category = /talent/i.test(context) ? 'Talent' : /ascension/i.test(context) ? 'Ascension' : inheritedCategory;

    const direct = materialFromObject(obj);
    if (direct) add({ ...direct, category: direct.category ?? category });

    const materialContext = /cost|material|ascension|talent|items|item|upgrade/i.test(context);
    Object.entries(obj).forEach(([key, child]) => {
      const isTechnical = /^(level|rank|id|type|category|name|description|source|obtain|amount|quantity|count)$/i.test(key);
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
      if (child && typeof child === 'object' && (/cost|material|ascension|talent|items|item|upgrade/i.test(key) || materialContext)) {
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
  return Object.entries(map).map(([level, row]) => ({ level, ...(asRecord(row)) })).filter((row) => ['20', '20+', '40', '40+', '50', '50+', '60', '60+', '70', '70+', '80', '80+', '90'].includes(String(row.level)));
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
