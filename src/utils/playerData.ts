const OWNED_KEY = 'teyvat-atlas:owned-characters:v1';
const MATERIAL_CHECKS_KEY = 'teyvat-atlas:material-checks:v1';

function readStringList(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeStringList(key: string, values: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify([...new Set(values)]));
  } catch {
    // Personal tools remain optional if the browser has disabled storage.
  }
}

export function readOwnedCharacterIds(): string[] {
  return readStringList(OWNED_KEY);
}

export function writeOwnedCharacterIds(ids: string[]) {
  writeStringList(OWNED_KEY, ids);
}

export function readMaterialChecks(planKey: string): string[] {
  return readStringList(`${MATERIAL_CHECKS_KEY}:${planKey}`);
}

export function writeMaterialChecks(planKey: string, names: string[]) {
  writeStringList(`${MATERIAL_CHECKS_KEY}:${planKey}`, names);
}
