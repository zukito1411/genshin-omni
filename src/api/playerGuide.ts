import type { CharacterGuide } from '../types/genshin';
import { readCache, writeCache } from './cache';
import { slugify } from '../utils/normalize';

export interface LivePlayerGuide extends CharacterGuide {
  source: string;
  sourceUrl: string;
  imageUrl?: string;
  fetchedAt: number;
  materials: Array<{ name: string; amount?: number; icon?: string; source?: string; category?: string }>;
}

interface ParsedSourceGuide extends LivePlayerGuide {
  sourceKey: string;
  quality: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000;
const STALE_REVALIDATE_TTL = 7 * 24 * 60 * 60 * 1000;
const SOURCE_TIMEOUT_MS = 10 * 1000;
const guideRefreshes = new Map<string, Promise<LivePlayerGuide>>();
const guideMemory = new Map<string, { value: LivePlayerGuide; expiresAt: number }>();

const SOURCES = {
  genshinBuilds: (slug: string) => `https://genshin-builds.com/en/character/${slug.replace(/-/g, '_')}`,
  icyVeins: (slug: string) => `https://www.icy-veins.com/genshin-impact/${slug}-guide-best-builds`,
};

const STRUCTURAL = /^(?:best|recommended|build|weapons?|artifacts?|stats?|teams?|talents?|constellations?|passives?|materials?|ascension|characters?|skills?|guides?|related guides?|show more|show less|list of contents|image|button|table of contents|author|changelog|published|last updated|f2p option|all recommended weapons|all artifacts|all teams)$/i;
const SOURCE_JUNK = /^(?:url source|published time|markdown content|home|characters|skills|9 ranked|\d+ ranked|version \d+(?:\.\d+)*|source|source url|markdown)$/i;
const ROLE_PATTERN = /\b(?:main dps|main-dps|sub dps|sub-dps|off-field dps|off field dps|support|healer|buffer|driver|enabler|on-field dps|on field dps)\b/i;

function clean(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  const out: string[] = [];
  for (const value of values.map(clean).filter(Boolean)) {
    if (!out.some((item) => item.toLowerCase() === value.toLowerCase())) out.push(value);
  }
  return out;
}

function normalizedName(value: string): string {
  return clean(value)
    .replace(/^\d+\s+/, '')
    .replace(/\s+\([^)]*\)\s*$/, '')
    .replace(/\s+R\d+\s*$/i, '')
    .trim();
}

function markdownLines(markdown: string): string[] {
  const result: string[] = [];
  for (const rawLine of markdown.split(/\r?\n/)) {
    let value = rawLine;
    value = value
      .replace(/<[^>]+>/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[cite_start\]|\[cite_end\]/g, '')
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .replace(/^\s*>\s*/, '')
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .replace(/\s*\|\s*/g, ' | ')
      .replace(/^Image:\s*/i, '')
      .replace(/&nbsp;/gi, ' ');
    value = clean(value);
    if (!value || /^[-:| ]+$/.test(value) || /^\d+$/.test(value)) continue;
    if (SOURCE_JUNK.test(value)) continue;
    if (result.length && result[result.length - 1] === value) continue;
    result.push(value);
  }
  return result;
}

function section(lines: string[], start: RegExp[], end: RegExp[] = []): string[] {
  const startIndex = lines.findIndex((line) => start.some((rx) => rx.test(line)));
  if (startIndex < 0) return [];
  const endIndex = lines.findIndex((line, index) => index > startIndex && end.some((rx) => rx.test(line)));
  return lines.slice(startIndex + 1, endIndex < 0 ? lines.length : endIndex);
}

/**
 * Keep source links until after we have identified the section. Markdown
 * headings can change, but weapon/artifact URLs are stable publisher-owned
 * identifiers and are safer than treating prose as an item name.
 */
function markdownSection(markdown: string, start: RegExp[], end: RegExp[] = []): string {
  const lines = markdown.split(/\r?\n/);
  const heading = (line: string) => clean(line.replace(/^\s*#{1,6}\s*/, ''));
  const startIndex = lines.findIndex((line) => start.some((rx) => rx.test(heading(line))));
  if (startIndex < 0) return '';
  const endIndex = lines.findIndex((line, index) => index > startIndex && end.some((rx) => rx.test(heading(line))));
  return lines.slice(startIndex + 1, endIndex < 0 ? lines.length : endIndex).join('\n');
}

function linkedCatalogNames(markdown: string, pathSegment: 'weapon' | 'weapons' | 'artifact' | 'artifacts', limit = 8): string[] {
  // `![Image 14](...)` is often followed by `[Artifact Name](...)`. Match
  // only the latter link; image alt text is never a recommendation name.
  const matches = markdown.matchAll(new RegExp(`(?:^|[^!])\\[([^\\]\\n]{2,100})\\]\\(https?:\\/\\/[^)\\s]*\\/${pathSegment}\\/[^)\\s]+\\)`, 'gim'));
  const names = [...matches]
    .map((match) => normalizedName(match[1]))
    .filter((name) => name && !STRUCTURAL.test(name) && !SOURCE_JUNK.test(name));
  return unique(names).slice(0, limit);
}

function titleFromAssetSlug(value: string): string {
  return value.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function genshinBuildsCardNames(markdown: string, folder: 'weapons' | 'artifacts', limit = 8): string[] {
  // Genshin Builds wraps a number of cards as an image inside a link. Preserve
  // the image alt label (when supplied) or its exact asset filename; both are
  // stable catalog identifiers and avoid ever parsing surrounding prose.
  const namedImages = [...markdown.matchAll(new RegExp(`!\\[Image\\s*\\d+\\s*:\\s*([^\\]]+)\\]\\([^)]*\\/genshin\\/${folder}\\/[^)]*\\)`, 'gi'))]
    .map((match) => normalizedName(match[1]));
  const filenames = [...markdown.matchAll(new RegExp(`https?:\\/\\/[^)\\s]*\\/genshin\\/${folder}\\/([^/?\\s)]+)\\.(?:png|webp)`, 'gi'))]
    .map((match) => titleFromAssetSlug(match[1]));
  return unique([...namedImages, ...filenames].filter((name) => name && !/^image\s*\d*$/i.test(name))).slice(0, limit);
}

function extractIntro(lines: string[]): string {
  const intro = lines.find((line) =>
    line.length >= 80 &&
    line.length <= 500 &&
    /(?:is a|is an|deals|provides|specializes|focuses|best built)/i.test(line) &&
    !SOURCE_JUNK.test(line),
  );
  return intro ?? '';
}

function extractRole(lines: string[]): string[] {
  const candidates = lines.slice(0, 180).flatMap((line, index, source) => {
    // A number of publishers render "Role" as a heading and place the value
    // on the next line. Keep that relationship instead of only inspecting
    // the heading text itself.
    if (/^(?:character )?(?:role|playstyle|position)\s*:?$/i.test(line)) return source.slice(index + 1, index + 4);
    return [line];
  }).filter((line) => {
    if (!ROLE_PATTERN.test(line) || line.length > 180) return false;
    return /^(?:main[- ]?dps|sub[- ]?dps|off[- ]field dps|on[- ]field dps|support|healer|buffer|driver|enabler)$/i.test(line) ||
      /(?:^|\b)(?:role|playstyle|position)\s*[:|-]/i.test(line) ||
      /\b(?:build|recommended)\b.*\b(?:main|sub|off[- ]field|on[- ]field|support|healer|buffer|driver|enabler)\b/i.test(line) ||
      /\b(?:main|sub|off[- ]field|on[- ]field)\s+dps\b/i.test(line) ||
      /\b(?:support|healer|buffer|driver|enabler)\b/i.test(line) && /\b(?:is|as|for|build)\b/i.test(line);
  });
  const found = candidates.flatMap((line) => line.match(/(?:Main DPS|Main-DPS|Sub-DPS|Sub DPS|Off-Field DPS|Off Field DPS|Support|Healer|Buffer|Driver|Enabler|On-Field DPS|On Field DPS)/gi) ?? []);
  return unique(found).slice(0, 3);
}

function extractStatsPriority(text: string): string[] {
  const matches = text.match(/(?:CRIT Rate|Crit Rate|CRIT DMG|Crit DMG|Crit Damage|DEF%|ATK%|HP%|Energy Recharge|\bER\b|Elemental Mastery|\bEM\b|Healing Bonus|Physical DMG(?: Bonus)?|Pyro DMG(?: Bonus)?|Cryo DMG(?: Bonus)?|Hydro DMG(?: Bonus)?|Electro DMG(?: Bonus)?|Dendro DMG(?: Bonus)?|Geo DMG(?: Bonus)?|Anemo DMG(?: Bonus)?)/gi) ?? [];
  const normalized = matches.map((value) => {
    if (/^crit damage$/i.test(value)) return 'CRIT DMG';
    if (/^crit rate$/i.test(value)) return 'CRIT Rate';
    if (/^er$/i.test(value)) return 'Energy Recharge';
    if (/^em$/i.test(value)) return 'Elemental Mastery';
    return value.replace(/\s+Bonus$/i, '');
  });
  return unique(normalized);
}

function extractTalentPriority(lines: string[]): string[] {
  const priorityHeading = lines.findIndex((line) => /^talent(?:s)?\s+priority\s*:?$/i.test(line));
  const candidates = priorityHeading >= 0
    ? lines.slice(priorityHeading + 1, priorityHeading + 6)
    : lines.filter((line) => /(?:Normal Attack|Elemental Skill|Elemental Burst|\bNA\b|\bE\b|\bQ\b).*(?:>|priority|first)/i.test(line));
  const values = candidates.flatMap((line) => line.match(/(?:Normal Attack|Elemental Skill|Elemental Burst|NA|E Skill|Q Burst|\bE\b|\bQ\b)/gi) ?? []);
  const normalized = values.map((value) => {
    if (/^(?:NA|Normal Attack)$/i.test(value)) return 'Normal Attack';
    if (/^(?:E|E Skill|Elemental Skill)$/i.test(value)) return 'Elemental Skill';
    if (/^(?:Q|Q Burst|Elemental Burst)$/i.test(value)) return 'Elemental Burst';
    return value;
  });
  return unique(normalized);
}

function extractMainStats(text: string): { sands: string; goblet: string; circlet: string } {
  const result = { sands: '', goblet: '', circlet: '' };
  const patterns: Array<[keyof typeof result, RegExp]> = [
    ['sands', /Sands(?: of Eon| of Eonothem)?\s*[:|]\s*([^|\n]+)/i],
    ['goblet', /Goblet(?: of Eonothem)?\s*[:|]\s*([^|\n]+)/i],
    ['circlet', /Circlet(?: of Logos)?\s*[:|]\s*([^|\n]+)/i],
  ];
  for (const [key, rx] of patterns) {
    const match = text.match(rx);
    if (match) result[key] = clean(match[1]);
  }
  return result;
}

function parseGenshinBuilds(markdown: string, slug: string, url: string): ParsedSourceGuide {
  const lines = markdownLines(markdown);
  const buildHeadingIndex = lines.findIndex((line) => /builds for/i.test(line) || /build build/i.test(line) || /build for/i.test(line));
  const buildRole = buildHeadingIndex >= 0 ? lines.slice(buildHeadingIndex, buildHeadingIndex + 8).find((line) => ROLE_PATTERN.test(line)) ?? '' : '';
  const role = unique([
    ...extractRole(lines),
    ...(buildRole.match(/(?:Main DPS|Main-DPS|Sub-DPS|Sub DPS|Off-Field DPS|Support|Healer|Buffer)/gi) ?? []),
  ]);

  const statSection = section(lines, [/^Recommended Primary Stats/i, /^Substats Priority/i], [/^Casting .* directly/i, /^Off-Field DPS/i, /^Most-used community build/i, /^Best teams/i]);
  const teamSection = section(lines, [/^Best teams/i, /^Best teams for/i, /^Team Compositions$/i], [/^Skills$/i, /^Passive Talents$/i, /^Constellations$/i, /^Outfits$/i, /^Stats$/i]);
  const talentSection = section(lines, [/^Talents Priority/i], [/^Casting .* directly/i, /^Most-used community build/i, /^Best teams/i, /^Skills$/i]);

  const weaponMarkdown = markdownSection(markdown, [/^Weapons$/i, /^Best Weapons/i], [/^Artifacts$/i, /^Substats Priority$/i, /^Talents Priority$/i, /^Recommended Primary Stats/i]);
  const artifactMarkdown = markdownSection(markdown, [/^Artifacts$/i, /^Best Artifacts/i], [/^Substats Priority$/i, /^Talents Priority$/i, /^Recommended Primary Stats/i, /^Most-used community build/i]);
  const weapons = unique([
    ...linkedCatalogNames(weaponMarkdown, 'weapon', 8),
    ...genshinBuildsCardNames(weaponMarkdown, 'weapons', 8),
  ]).slice(0, 8);
  const artifacts = unique([
    ...linkedCatalogNames(artifactMarkdown, 'artifact', 8),
    ...genshinBuildsCardNames(artifactMarkdown, 'artifacts', 8),
  ]).slice(0, 8);
  const substats = extractStatsPriority(statSection.join(' | '));
  const mainStats = extractMainStats(statSection.join(' | '));

  const talentPriority = extractTalentPriority([...talentSection, ...lines.slice(0, 180)]);

  const teams: CharacterGuide['teams'] = [];
  for (let i = 0; i < teamSection.length; i += 1) {
    const line = teamSection[i];
    const composition = line.match(/Team composition:\s*(.+)$/i)?.[1];
    if (!composition) continue;
    const members = unique(composition.split(/,\s*/).map((part) => part.replace(/\s*\([^)]*\)/g, '').trim()));
    if (members.length !== 4 || !members.some((member) => member.toLowerCase() === slug.replace(/-/g, ' '))) continue;
    const teamTitle = teamSection[i - 1] && !STRUCTURAL.test(teamSection[i - 1]) ? teamSection[i - 1] : `Team ${teams.length + 1}`;
    teams.push({
      name: clean(teamTitle),
      members,
      note: teamSection[i - 2] && teamSection[i - 2].length > 50 ? teamSection[i - 2] : `Recommended team composition from Genshin Builds.`,
      source: url,
    });
  }

  const description = lines.find((line) => /^#? Best .* Build:/i.test(line)) ?? '';
  const summary = extractIntro(lines) || clean(description.replace(/^#/, '').replace(/\s*\(v[\d.]+\).*$/i, ''));

  return {
    characterId: slug,
    role,
    summary,
    statPriority: substats,
    talentPriority,
    weapons: weapons.map((name, index) => ({ name, tier: index === 0 ? 'Best in Slot' : index <= 2 ? 'Strong Alternative' : `Option ${index + 1}`, note: 'Ranked recommendation from Genshin Builds.', source: url })),
    artifacts: artifacts.map((set, index) => ({ set, pieces: /\b[24]$/.test(set) ? set.match(/\b[24]$/)?.[0] + '-piece' : index === 0 ? 'Best in Slot' : index <= 2 ? 'Strong Alternative' : 'Alternative', note: 'Ranked recommendation from Genshin Builds.', source: url })),
    mainStats,
    teams,
    source: 'Genshin Builds',
    sourceKey: 'genshinBuilds',
    sourceUrl: url,
    fetchedAt: Date.now(),
    materials: [],
    sourceLinks: [{ label: 'Genshin Builds', url }],
    quality: (weapons.length ? 2 : 0) + (artifacts.length ? 2 : 0) + (mainStats.sands ? 2 : 0) + (teams.length ? 2 : 0) + (talentPriority.length ? 1 : 0) + (substats.length ? 1 : 0),
  };
}

function parseIcyVeins(markdown: string, slug: string, url: string): ParsedSourceGuide {
  const lines = markdownLines(markdown);
  const role = extractRole(lines);
  const statsStart = lines.findIndex((line) => /Stat Priority$/i.test(line));
  const talentStart = lines.findIndex((line) => /Talent Priority$/i.test(line));
  const statLines = statsStart >= 0 ? lines.slice(statsStart + 1, talentStart >= 0 ? talentStart : lines.length) : [];
  const weaponNames = linkedCatalogNames(markdownSection(markdown, [/^Best Weapons for /i], [/^Best Artifacts for /i]), 'weapons', 8);
  const artifactNames = linkedCatalogNames(markdownSection(markdown, [/^Best Artifacts for /i], [/^.+Stat Priority$/i, /^.+Talent Priority$/i, /^How to Play /i]), 'artifacts', 8);
  const mainStats = extractMainStats(statLines.join(' | '));
  const substats = extractStatsPriority(statLines.join(' | '));
  const talentPriority = extractTalentPriority(lines);
  const teamUrl = url.replace(/-guide-best-builds$/, '-team-guide');
  return {
    characterId: slug,
    role,
    summary: extractIntro(lines),
    statPriority: substats,
    talentPriority,
    weapons: weaponNames.map((name, index) => ({ name, tier: index === 0 ? 'Best in Slot' : index <= 2 ? 'Strong Alternative' : `Option ${index + 1}`, note: 'Ranked recommendation from Icy Veins.', source: url })),
    artifacts: artifactNames.map((set, index) => ({ set, pieces: index === 0 ? 'Best in Slot' : index <= 2 ? 'Strong Alternative' : 'Alternative', note: index === 0 ? 'Highest-ranked artifact recommendation from Icy Veins.' : 'Ranked alternative from Icy Veins.', source: url })),
    mainStats,
    teams: [],
    source: 'Icy Veins',
    sourceKey: 'icyVeins',
    sourceUrl: url,
    fetchedAt: Date.now(),
    materials: [],
    sourceLinks: [{ label: 'Icy Veins Build', url }, { label: 'Icy Veins Teams', url: teamUrl }],
    quality: (weaponNames.length ? 2 : 0) + (artifactNames.length ? 2 : 0) + (mainStats.sands ? 2 : 0) + (talentPriority.length ? 1 : 0) + (substats.length ? 1 : 0),
  };
}

async function readSource(url: string, signal?: AbortSignal): Promise<string> {
  const readerUrl = `https://r.jina.ai/${url}`;
  let lastError: unknown;
  // A public reader occasionally drops a request even while the original guide
  // is healthy. Retry once before treating the source as unavailable.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
    const abortFromCaller = () => controller.abort();
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener('abort', abortFromCaller, { once: true });
    try {
      const response = await fetch(readerUrl, {
        signal: controller.signal,
        headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
      });
      if (!response.ok) throw new Error(`Source request failed (${response.status})`);
      const text = await response.text();
      if (text.length < 500) throw new Error('Source returned too little content.');
      return text;
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      lastError = error;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Build source request failed.');
}

function mergeSourceGuides(guides: ParsedSourceGuide[], slug: string): LivePlayerGuide {
  const ordered = [...guides].sort((a, b) => b.quality - a.quality);
  const primary = ordered.find((guide) => guide.sourceKey === 'genshinBuilds') ?? ordered[0];
  if (!primary) throw new Error('No usable source guide was returned.');

  // Icy Veins publishes stable, linked catalog entries for equipment. The
  // Genshin Builds reader output can replace image-only cards with prose, so
  // it remains the preferred team source but cannot override linked equipment.
  const equipmentGuide = ordered.find((guide) => guide.sourceKey === 'icyVeins' && guide.weapons.length && guide.artifacts.length);

  const bestList = <T,>(field: keyof CharacterGuide): T[] => {
    const lists = ordered.map((guide) => guide[field]).filter(Array.isArray) as T[][];
    return [...lists].sort((a, b) => b.length - a.length)[0] ?? [];
  };
  const firstNonEmptyMainStat = (key: keyof LivePlayerGuide['mainStats']) => ordered.find((guide) => guide.mainStats[key])?.mainStats[key] ?? '';

  return {
    ...primary,
    characterId: slug,
    source: ordered.map((guide) => guide.source).join(' + '),
    sourceUrl: primary.sourceUrl,
    role: bestList<string>('role'),
    summary: primary.summary || ordered.find((guide) => guide.summary)?.summary || '',
    statPriority: bestList<string>('statPriority'),
    talentPriority: bestList<string>('talentPriority'),
    weapons: equipmentGuide?.weapons ?? (primary.weapons.length ? primary.weapons : bestList<LivePlayerGuide['weapons'][number]>('weapons')),
    artifacts: equipmentGuide?.artifacts ?? (primary.artifacts.length ? primary.artifacts : bestList<LivePlayerGuide['artifacts'][number]>('artifacts')),
    mainStats: {
      sands: primary.mainStats.sands || firstNonEmptyMainStat('sands'),
      goblet: primary.mainStats.goblet || firstNonEmptyMainStat('goblet'),
      circlet: primary.mainStats.circlet || firstNonEmptyMainStat('circlet'),
    },
    teams: ordered.flatMap((guide) => guide.teams).filter((team, index, all) => all.findIndex((other) => other.name.toLowerCase() === team.name.toLowerCase()) === index).slice(0, 8),
    sourceLinks: ordered.flatMap((guide) => guide.sourceLinks ?? []).filter((link, index, all) => all.findIndex((other) => other.url === link.url) === index),
    fetchedAt: Date.now(),
    materials: primary.materials,
  };
}

function hasCompleteBuild(guide: LivePlayerGuide): boolean {
  // A summary alone is not a usable build. Do not cache or render a partial
  // scrape as if it were authoritative.
  return guide.weapons.length > 0 && guide.artifacts.length > 0 && guide.teams.length > 0;
}

async function refreshGuide(cleanSlug: string, signal?: AbortSignal, onUpdate?: (guide: LivePlayerGuide) => void): Promise<LivePlayerGuide> {
  const jobs: Array<Promise<ParsedSourceGuide>> = [];
  const available: ParsedSourceGuide[] = [];
  const publish = (guide: ParsedSourceGuide) => {
    if (guide.quality < 3) return;
    available.push(guide);
    // Publish each verified source as it arrives. This permits the artifact
    // cards to appear while teams or another source are still loading.
    onUpdate?.(mergeSourceGuides(available, cleanSlug));
  };

  const genshinBuildsUrl = SOURCES.genshinBuilds(cleanSlug);
  const icyVeinsUrl = SOURCES.icyVeins(cleanSlug);

  jobs.push(readSource(genshinBuildsUrl, signal).then((md) => parseGenshinBuilds(md, cleanSlug, genshinBuildsUrl)).then((guide) => { publish(guide); return guide; }));
  jobs.push(readSource(icyVeinsUrl, signal).then((md) => parseIcyVeins(md, cleanSlug, icyVeinsUrl)).then((guide) => { publish(guide); return guide; }));

  const results = await Promise.allSettled(jobs);
  const guides = results
    .filter((result): result is PromiseFulfilledResult<ParsedSourceGuide> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((guide) => guide.quality >= 3);

  if (!guides.length) throw new Error('No usable maintained player-build source was available.');
  const guide = mergeSourceGuides(guides, cleanSlug);
  if (!hasCompleteBuild(guide)) throw new Error('The public build sources returned incomplete recommendations.');
  return guide;
}

async function refreshCompleteGuide(cleanSlug: string, signal?: AbortSignal, onUpdate?: (guide: LivePlayerGuide) => void): Promise<LivePlayerGuide> {
  let lastError: unknown;
  // Retry the whole source set once. This catches the common case where one
  // reader request is rate-limited while the other source is still reachable.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await refreshGuide(cleanSlug, signal, onUpdate);
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      lastError = error;
      if (attempt === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Complete build data is unavailable.');
}

function refreshGuideOnce(cleanSlug: string, onUpdate?: (guide: LivePlayerGuide) => void): Promise<LivePlayerGuide> {
  const pending = guideRefreshes.get(cleanSlug);
  if (pending) return pending;
  const request = refreshCompleteGuide(cleanSlug, undefined, onUpdate)
    .finally(() => guideRefreshes.delete(cleanSlug));
  guideRefreshes.set(cleanSlug, request);
  return request;
}

export async function fetchPlayerGuide(slug: string, signal?: AbortSignal, onUpdate?: (guide: LivePlayerGuide) => void): Promise<LivePlayerGuide> {
  const cleanSlug = slugify(slug);
  // v11 invalidates guide entries from before labeled-field extraction.
  const cacheKey = `player-guide:${cleanSlug}:v11`;
  const inMemory = guideMemory.get(cacheKey);
  if (inMemory && Date.now() < inMemory.expiresAt) { onUpdate?.(inMemory.value); return inMemory.value; }
  const cached = readCache<LivePlayerGuide>(cacheKey);

  // Cached guides are returned without a network request when reopening a
  // character. The in-memory copy avoids even localStorage parsing while the
  // app stays open.
  if (cached && !cached.stale) {
    guideMemory.set(cacheKey, { value: cached.value, expiresAt: Date.now() + CACHE_TTL });
    onUpdate?.(cached.value);
    return cached.value;
  }
  if (cached && Date.now() - (cached.value.fetchedAt ?? 0) < STALE_REVALIDATE_TTL) {
    onUpdate?.(cached.value);
    void refreshGuideOnce(cleanSlug, onUpdate).then((fresh) => {
      guideMemory.set(cacheKey, { value: fresh, expiresAt: Date.now() + CACHE_TTL });
      writeCache(cacheKey, fresh, CACHE_TTL);
    }).catch(() => undefined);
    return cached.value;
  }

  // Foreground page loads use their own cancellation signal. Shared refreshes
  // are reserved for background cache revalidation.
  const fresh = signal ? await refreshCompleteGuide(cleanSlug, signal, onUpdate) : await refreshGuideOnce(cleanSlug, onUpdate);
  guideMemory.set(cacheKey, { value: fresh, expiresAt: Date.now() + CACHE_TTL });
  writeCache(cacheKey, fresh, CACHE_TTL);
  return fresh;
}
