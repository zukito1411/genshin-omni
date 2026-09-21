import { getJson, getText } from './http';
import { slugify } from '../utils/normalize';
import type { GenshinCharacter, LibraryEntity } from '../types/genshin';

const BASE_URL = 'https://genshin.jmp.blue';
const ENKA_UI = 'https://enka.network/ui/';
const HAKUSH_UI = 'https://static.nanoka.cc/gi/UI/';
const YATTA_UI = 'https://gi.yatta.moe/assets/UI/';
const AMBR_UI = 'https://api.ambr.top/assets/UI/';
const WIKI_FILE = 'https://genshin-impact.fandom.com/wiki/Special:FilePath/';
const TRAVELER_BUILD_IMAGE = 'https://i2.wp.com/images.genshin-builds.com/genshin/characters/traveler/image.png?strip=all&quality=100&w=512';
const TRAVELER_COMBINED_IMAGE = 'https://static.wikia.nocookie.net/gensin-impact/images/7/71/Character_Traveler_Thumb.png';
const BUILD_ASSET_ALIASES: Record<string, string> = {
  'ash-graven-drinking-horn': 'ashgraven_drinking_horn',
  'sunny-morning-sleep-in': 'sunny_morning_sleepin',
  'flame-forged-insight': 'flameforged_insight',
};
const assetMaps = new Map<string, Record<string, string>>();
const assetMapRequests = new Map<string, Promise<Record<string, string>>>();

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function withExtension(value: string, extension: string): string {
  return /\.[a-z0-9]+$/i.test(value) ? value : `${value}${extension}`;
}

function cdnCandidates(filename?: string, assetType: 'characters' | 'weapons' | 'artifacts' = 'characters'): string[] {
  if (!filename) return [];
  const file = withExtension(filename, '.png');
  const mihoyoFolder = assetType === 'characters' ? 'character_icon' : 'equip';
  return unique([
    `https://upload-os-bbs.mihoyo.com/game_record/genshin/${mihoyoFolder}/${encodeURIComponent(file)}`,
    `${ENKA_UI}${encodeURIComponent(file)}`,
    `${HAKUSH_UI}${encodeURIComponent(withExtension(filename, '.webp'))}`,
    `${YATTA_UI}${encodeURIComponent(withExtension(filename, '.png'))}`,
    `${AMBR_UI}${encodeURIComponent(file)}`,
    `${WIKI_FILE}${encodeURIComponent(file)}`,
  ]);
}

const CHARACTER_ASSET_ALIASES: Record<string, string[]> = {
  aether: ['PlayerBoy'],
  lumine: ['PlayerGirl'],
  traveler: ['PlayerBoy', 'PlayerGirl'],
};

function iconNameCandidates(name: string): string[] {
  const compact = name.replace(/[^A-Za-z0-9]+(.)?/g, (_match, next) => next ? String(next).toUpperCase() : '');
  const title = compact ? compact.charAt(0).toUpperCase() + compact.slice(1) : '';
  const spaced = name.trim().replace(/\s+/g, '');
  const underscored = name.trim().replace(/\s+/g, '_');
  return unique([...(CHARACTER_ASSET_ALIASES[name.trim().toLowerCase()] ?? []), title, spaced, underscored]);
}

function characterIconCdnSources(name: string): string[] {
  return iconNameCandidates(name).flatMap((candidate) => cdnCandidates(`UI_AvatarIcon_${candidate}`));
}

function entityIconCdnSources(type: string, name: string): string[] {
  const compactNames = iconNameCandidates(name);
  const prefix = type === 'weapons' ? 'UI_EquipIcon_' : type === 'artifacts' ? 'UI_RelicIcon_' : '';
  if (!prefix) return [];
  return compactNames.flatMap((candidate) => cdnCandidates(`${prefix}${candidate}`, type as 'weapons' | 'artifacts'));
}

export function genshinDevId(nameOrId: string) { return slugify(nameOrId); }

export function assetKey(folder: string, name: string): string {
  return `${folder}:${slugify(name)}`;
}

export function elementImageSources(element?: string): string[] {
  const name = element?.trim();
  if (!name || !/^(?:Anemo|Cryo|Dendro|Electro|Geo|Hydro|Pyro)$/i.test(name)) return [];
  const canonical = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return [`https://i2.wp.com/images.genshin-builds.com/genshin/elements/${canonical}.png?strip=all&quality=100&w=32`];
}

export function genshinBuildsImage(folder: 'characters' | 'weapons' | 'artifacts', name: string): string {
  const normalized = slugify(name);
  const slug = encodeURIComponent(BUILD_ASSET_ALIASES[normalized] ?? normalized);
  const path = folder === 'characters' ? `${slug}/image.png` : `${slug}.png`;
  return `https://i2.wp.com/images.genshin-builds.com/genshin/${folder}/${path}?strip=all&quality=100&w=512`;
}

export function fetchGenshinBuildsAssetMap(folder: 'characters' | 'weapons' | 'artifacts', signal?: AbortSignal): Promise<Record<string, string>> {
  const cached = assetMaps.get(folder);
  if (cached) return Promise.resolve(cached);
  const pending = assetMapRequests.get(folder);
  if (pending) return pending;

  const request = loadGenshinBuildsAssetMap(folder, signal)
    .then((assets) => { assetMaps.set(folder, assets); return assets; })
    .finally(() => assetMapRequests.delete(folder));
  assetMapRequests.set(folder, request);
  return request;
}

async function loadGenshinBuildsAssetMap(folder: 'characters' | 'weapons' | 'artifacts', signal?: AbortSignal): Promise<Record<string, string>> {
  const markdown = await getText(`https://r.jina.ai/https://genshin-builds.com/en/${folder}`, signal, { cacheKey: `genshin-builds-assets:${folder}:v4`, ttlMs: 24 * 60 * 60 * 1000 });
  const normalized = markdown.replace(/\s+/g, ' ');
  const assets: Record<string, string> = {};
  const marker = `https://i2.wp.com/images.genshin-builds.com/genshin/${folder}/`;
  for (const segment of normalized.split(marker).slice(1)) {
    const end = segment.indexOf(')');
    if (end < 0) continue;
    const url = marker + segment.slice(0, end);
    const path = url.split('?')[0];
    const parts = path.split('/');
    const filename = parts.at(-1)?.replace(/\.png$/i, '');
    const slug = folder === 'characters' ? parts.at(-2) : filename;
    if (slug) {
      const key = slugify(slug.replace(/_/g, ' '));
      assets[key] = url;
      assets[key.replace(/-/g, '')] = url;
    }
  }
  return assets;
}

export function findGenshinBuildsAsset(assets: Record<string, string>, name: string): string | undefined {
  const key = slugify(name);
  return assets[key] ?? assets[key.replace(/-/g, '')];
}

export function entityImage(type: string, id: string, imageType = 'icon') {
  return `${BASE_URL}/${type}/${encodeURIComponent(genshinDevId(id))}/${encodeURIComponent(imageType)}`;
}

export async function fetchEntityDetail(type: string, nameOrId: string, signal?: AbortSignal) {
  const id = genshinDevId(nameOrId);
  return getJson<Record<string, unknown>>(`${BASE_URL}/${type}/${encodeURIComponent(id)}?lang=en`, signal, { cacheKey: `dev:${type}:${id}`, ttlMs: 12 * 60 * 60 * 1000 });
}

function directImage(value?: string): string[] {
  return value && /^https?:\/\//i.test(value) ? [value] : [];
}

function filenameFrom(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.split('/').pop()?.trim();
  return cleaned || undefined;
}

export function characterImageSources(character: Pick<GenshinCharacter, 'id' | 'name' | 'images'>, kind: 'card' | 'portrait' | 'icon' = 'card'): string[] {
  const { images } = character;
  const files = images.files ?? {};
  const filenames = kind === 'icon'
    ? [files.icon, files.iconCard, files.sideIcon]
    : kind === 'portrait'
      ? [files.gachaSplash, files.gachaSlice, files.iconCard, files.icon, files.sideIcon]
      : [files.iconCard, files.icon, files.sideIcon, files.gachaSplash, files.gachaSlice];

  const raw = kind === 'portrait'
    ? [images.image, images.portrait, images.gacha, images.card, images.mihoyoIcon, images.hoyowikiIcon, images.mihoyoSideIcon]
    : kind === 'icon'
      ? [images.image, images.icon, images.card, images.portrait, images.mihoyoIcon, images.hoyowikiIcon, images.mihoyoSideIcon]
      : [images.image, images.card, images.icon, images.portrait, images.gacha, images.mihoyoIcon, images.hoyowikiIcon, images.mihoyoSideIcon];

  const genshinTypes = kind === 'portrait' ? ['portrait', 'icon', 'card'] : ['icon', 'card', 'portrait'];
  const isTraveler = /^(?:aether|lumine|traveler)$/i.test(character.name || character.id);

  return unique([
    ...(isTraveler ? [TRAVELER_BUILD_IMAGE, TRAVELER_COMBINED_IMAGE] : []),
    genshinBuildsImage('characters', character.name || character.id),
    ...raw.flatMap(directImage),
    ...genshinTypes.map((imageType) => entityImage('characters', character.name || character.id, imageType)),
    ...filenames.flatMap((filename) => cdnCandidates(filename, 'characters')),
    ...characterIconCdnSources(character.name || character.id),
  ]);
}

export function characterImages(nameOrId: string) {
  const id = genshinDevId(nameOrId);
  return {
    icon: entityImage('characters', id, 'icon'),
    card: entityImage('characters', id, 'card'),
    portrait: entityImage('characters', id, 'portrait'),
    gacha: entityImage('characters', id, 'gacha-card'),
  };
}

export function entityImageSources(type: string, entity: Pick<LibraryEntity, 'name' | 'icon' | 'raw'>, kind: 'icon' = 'icon'): string[] {
  const raw = asRecord(entity.raw);
  const rawValues = [
    raw.icon, raw.iconPath, raw.nameicon, raw.nameIcon, raw.nameIconCard, raw.awakenIcon,
    ...Object.values(asRecord(raw.images)),
  ];
  const rawImages = rawValues.filter((value): value is string => typeof value === 'string').flatMap(directImage);
  const filenameCandidates = rawValues
    .filter((value): value is string => typeof value === 'string')
    .map(filenameFrom)
    .filter((value): value is string => Boolean(value && (/^(UI_|Skill_)/i.test(value) || /\.(png|webp|jpg|jpeg)$/i.test(value))));

  const entityImages = type === 'artifacts'
    ? ['flower-of-life', 'plume-of-death', 'sands-of-eon', 'goblet-of-eonothem', 'circlet-of-logos'].map((imageType) => entityImage(type, entity.name, imageType))
    : [entityImage(type, entity.name, kind)];

  return unique([
    ...directImage(entity.icon),
    genshinBuildsImage(type as 'weapons' | 'artifacts', entity.name),
    ...rawImages,
    ...entityImages,
    ...filenameCandidates.flatMap((filename) => cdnCandidates(filename, type as 'weapons' | 'artifacts')),
    ...entityIconCdnSources(type, entity.name),
  ]);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
