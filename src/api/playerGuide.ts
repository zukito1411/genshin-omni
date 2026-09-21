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

const CACHE_TTL = 12 * 60 * 60 * 1000;
const STALE_REVALIDATE_TTL = 7 * 24 * 60 * 60 * 1000;
const SOURCE_TIMEOUT_MS = 10 * 1000;
const guideRefreshes = new Map<string, Promise<LivePlayerGuide>>();

const SOURCES = {
  genshinBuilds: (slug: string) => `https://genshin-builds.com/en/character/${slug.replace(/-/g, '_')}`,
  icyVeins: (slug: string) => `https://www.icy-veins.com/genshin-impact/${slug}-guide-best-builds`,
  game8Search: (slug: string) => `https://game8.co/games/Genshin-Impact/archives?search=${encodeURIComponent(slug.replace(/-/g, ' '))}`,
  kqm: (slug: string) => `https://keqingmains.com/q/${slug}-quickguide/`,
};

const STRUCTURAL = /^(?:best|recommended|build|weapons?|artifacts?|stats?|teams?|talents?|constellations?|passives?|materials?|ascension|characters?|skills?|guides?|related guides?|show more|show less|list of contents|image|button|table of contents|author|changelog|published|last updated|f2p option|all recommended weapons|all artifacts|all teams)$/i;
const SOURCE_JUNK = /^(?:url source|published time|markdown content|home|characters|skills|9 ranked|\d+ ranked|version \d+(?:\.\d+)*|source|source url|markdown)$/i;
const STAT_TOKENS = /^(?:HP|ATK|DEF|CRIT|CRIT Rate|CRIT DMG|Energy Recharge|Elemental Mastery|Healing Bonus|Pyro DMG|Cryo DMG|Hydro DMG|Electro DMG|Dendro DMG|Geo DMG|Anemo DMG|Physical DMG|ATK%|DEF%|HP%)$/i;
const WEAPON_STATS = /\b(?:ATK|DEF|CRIT Rate|CRIT DMG|Energy Recharge|Elemental Mastery|HP)\s*(?:%|Bonus)?\b/i;
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
  const candidates = lines.slice(0, 100).filter((line) => {
    if (!ROLE_PATTERN.test(line) || line.length > 180) return false;
    return /(?:^|\b)(?:role|playstyle|position)\s*[:|-]/i.test(line) ||
      /\b(?:build|recommended)\b.*\b(?:main|sub|off[- ]field|on[- ]field|support|healer|buffer|driver|enabler)\b/i.test(line) ||
      /\b(?:main|sub|off[- ]field|on[- ]field)\s+dps\b/i.test(line) && /\bbuild\b/i.test(line);
  });
  const best = candidates[0] ?? '';
  if (!best) return [];
  const found = best.match(/(?:Main DPS|Main-DPS|Sub-DPS|Sub DPS|Off-Field DPS|Off Field DPS|Support|Healer|Buffer|Driver|Enabler|On-Field DPS|On Field DPS)/gi) ?? [];
  return unique(found);
}

function extractStatsPriority(text: string): string[] {
  const matches = text.match(/(?:CRIT Rate|CRIT DMG|DEF%|ATK%|HP%|Energy Recharge|Elemental Mastery|Healing Bonus|Physical DMG|Pyro DMG|Cryo DMG|Hydro DMG|Electro DMG|Dendro DMG|Geo DMG|Anemo DMG)/gi) ?? [];
  return unique(matches);
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

function parseDelimitedNames(lines: string[], allowStats = false, limit = 8): string[] {
  const output: string[] = [];
  for (const line of lines) {
    let value = normalizedName(line);
    if (!value || STRUCTURAL.test(value) || SOURCE_JUNK.test(value)) continue;
    if (/^(?:r\d|\d+%|option \d+|top recommendation|alternative|recommended|rank|score)$/i.test(value)) continue;
    if (/^(?:sands|goblet|circlet|substats?|main stats?|talent priority)$/i.test(value)) continue;
    if (WEAPON_STATS.test(value)) {
      const stripped = value
        .replace(/\s+R\d+\s*$/i, '')
        .replace(/\s+(?:HP|ATK|DEF|CRIT Rate|CRIT DMG|Energy Recharge|Elemental Mastery)(?:%| Bonus)?\s*$/i, '')
        .trim();
      if (stripped) value = stripped;
    }
    if (value.includes(' | ')) {
      const parts = value.split(' | ').map(clean).filter(Boolean);
      const candidate = parts.find((part) => !STRUCTURAL.test(part) && !STAT_TOKENS.test(part) && part.length > 2 && part.length < 90);
      value = candidate ?? value;
    }
    if (!allowStats && value.length > 90) continue;
    if (value.length < 2 || value.length > 100) continue;
    if (/^(?:the|this|use|when|provides|offers|grants|good|great|best|ideal|recommended)\b/i.test(value)) continue;
    if (!allowStats && (/[%:]/.test(value) || value.length > 65 || value.split(/\s+/).length > 10)) continue;
    if (!allowStats && /^(?:ATK|DEF|HP|EM|ER|CRIT|Passive|Normal|Elemental|When|After|Using|Increases?|Boosts?|Grants?|Deals?|Converts?)\b/i.test(value)) continue;
    if (!output.some((item) => item.toLowerCase() === value.toLowerCase())) output.push(value);
    if (output.length >= limit) break;
  }
  return output;
}

function parseGenshinBuilds(markdown: string, slug: string, url: string): ParsedSourceGuide {
  const lines = markdownLines(markdown);
  const buildHeadingIndex = lines.findIndex((line) => /builds for/i.test(line) || /build build/i.test(line) || /build for/i.test(line));
  const buildRole = buildHeadingIndex >= 0 ? lines.slice(buildHeadingIndex, buildHeadingIndex + 8).find((line) => ROLE_PATTERN.test(line)) ?? '' : '';
  const role = unique([
    ...extractRole(lines),
    ...(buildRole.match(/(?:Main DPS|Main-DPS|Sub-DPS|Sub DPS|Off-Field DPS|Support|Healer|Buffer)/gi) ?? []),
  ]);

  const weaponsSection = section(lines, [/^Weapons$/i, /^Best Weapons/i], [/^Artifacts$/i, /^Substats Priority$/i, /^Talents Priority$/i, /^Recommended Primary Stats/i]);
  const artifactsSection = section(lines, [/^Artifacts$/i, /^Best Artifacts/i], [/^Substats Priority$/i, /^Talents Priority$/i, /^Recommended Primary Stats/i, /^Most-used community build/i]);
  const statSection = section(lines, [/^Recommended Primary Stats/i, /^Substats Priority/i], [/^Casting .* directly/i, /^Off-Field DPS/i, /^Most-used community build/i, /^Best teams/i]);
  const teamSection = section(lines, [/^Best teams/i, /^Best teams for/i, /^Team Compositions$/i], [/^Skills$/i, /^Passive Talents$/i, /^Constellations$/i, /^Outfits$/i, /^Stats$/i]);
  const talentSection = section(lines, [/^Talents Priority/i], [/^Casting .* directly/i, /^Most-used community build/i, /^Best teams/i, /^Skills$/i]);

  const weapons = parseDelimitedNames(weaponsSection, false, 8);
  const artifacts = parseDelimitedNames(artifactsSection, false, 8);
  const statText = [statSection.join(' | '), markdown].join(' | ');
  const substats = extractStatsPriority(statSection.filter((line) => /substats?/i.test(line)).join(' | '));
  const mainStats = extractMainStats(statSection.join(' | '));

  const talentPriorityLine = talentSection.find((line) => /\b(?:E|Q|NA)\b|Normal Attack|Elemental Skill|Elemental Burst/i.test(line));
  const talentPriority = unique(
    talentPriorityLine
      ? (talentPriorityLine.match(/(?:Normal Attack|Elemental Skill|Elemental Burst|E Skill|Q Burst|NA Normal Attack|E|Q|NA)/gi) ?? [])
      : [],
  );

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
    weapons: weapons.map((name, index) => ({ name, tier: index === 0 ? 'Top recommendation' : `Option ${index + 1}`, note: 'Ranked recommendation from Genshin Builds.', source: url })),
    artifacts: artifacts.map((set, index) => ({ set, pieces: /\b[24]$/.test(set) ? set.match(/\b[24]$/)?.[0] + '-piece' : index === 0 ? 'Recommended' : 'Alternative', note: 'Ranked recommendation from Genshin Builds.', source: url })),
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
  const text = lines.join(' | ');
  const role = extractRole(lines);
  const weaponStart = lines.findIndex((line) => /^Best Weapons for /i.test(line));
  const artifactStart = lines.findIndex((line) => /^Best Artifacts for /i.test(line));
  const statsStart = lines.findIndex((line) => /Stat Priority$/i.test(line));
  const talentStart = lines.findIndex((line) => /Talent Priority$/i.test(line));
  const weaponLines = weaponStart >= 0 ? lines.slice(weaponStart + 1, artifactStart >= 0 ? artifactStart : lines.length) : [];
  const artifactLines = artifactStart >= 0 ? lines.slice(artifactStart + 1, statsStart >= 0 ? statsStart : lines.length) : [];
  const statLines = statsStart >= 0 ? lines.slice(statsStart + 1, talentStart >= 0 ? talentStart : lines.length) : [];
  const weaponNames = unique(weaponLines.filter((line) => /\(R\d\)\s+\d+%$/.test(line)).map((line) => normalizedName(line))).slice(0, 8);
  const artifactNames = unique(artifactLines.filter((line) => /^\d+\s*%$/.test(line) === false && /(?:Husk of Opulent Dreams|Golden Troupe|Archaic Petra|Tenacity of the Millelith|Celestial Gift|Desert Pavilion Chronicle|Crimson Witch|Noblesse Oblige|Deepwood Memories|Flower of Paradise Lost|Marechaussee Hunter|Nighttime Whispers)/i.test(line)).map((line) => normalizedName(line))).slice(0, 8);
  const mainStats = extractMainStats(statLines.join(' | '));
  const substats = extractStatsPriority(statLines.find((line) => /^Substats?:/i.test(line)) ?? '');
  const talentLine = lines.find((line) => /^Talent Priority:/i.test(line));
  const talentPriority = talentLine ? unique((talentLine.split(':').slice(1).join(':').match(/[^>]+/g) ?? []).map((item) => clean(item)).slice(0, 5)) : [];
  const teamUrl = url.replace(/-guide-best-builds$/, '-team-guide');
  return {
    characterId: slug,
    role,
    summary: extractIntro(lines),
    statPriority: substats,
    talentPriority,
    weapons: weaponNames.map((name, index) => ({ name, tier: index === 0 ? 'Top recommendation' : `Option ${index + 1}`, note: 'Ranked recommendation from Icy Veins.', source: url })),
    artifacts: artifactNames.map((set, index) => ({ set, pieces: 'Recommended', note: index === 0 ? 'Primary artifact recommendation from Icy Veins.' : 'Alternative artifact recommendation from Icy Veins.', source: url })),
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

function parseGame8(markdown: string, slug: string, url: string): ParsedSourceGuide {
  const lines = markdownLines(markdown);
  const text = lines.join(' | ');
  const weapons = unique((text.match(/Best Weapon\s*\|\s*([^|]+)/i)?.[1] ?? '').split(/\s*\d+\.\s*/).filter(Boolean)).slice(0, 6);
  const replacements = unique((text.match(/Replacement Weapons\s*\|\s*([^|]+)/i)?.[1] ?? '').split(/\s*\d+\.\s*/).filter(Boolean)).slice(0, 6);
  const artifactMatch = text.match(/Best Artifacts\s*\|\s*([^|]+)/i)?.[1] ?? '';
  const artifacts = unique([artifactMatch, ...text.match(/(?:Husk of Opulent Dreams|Golden Troupe|Celestial Gift|Archaic Petra|Tenacity of the Millelith)[^|\n]*/gi) ?? []]).slice(0, 6);
  const mainStats = extractMainStats(text.replace(/\s*\|\s*/g, ' | '));
  const statLine = text.match(/Artifact Sub Stats\s*\|\s*([^|]+)/i)?.[1] ?? '';
  const statPriority = extractStatsPriority(statLine);
  const role = extractRole(lines);
  return {
    characterId: slug,
    role,
    summary: extractIntro(lines),
    statPriority,
    talentPriority: [],
    weapons: unique([...weapons, ...replacements]).map((name, index) => ({ name, tier: index === 0 ? 'Top recommendation' : `Option ${index + 1}`, note: 'Recommendation from Game8.', source: url })),
    artifacts: artifacts.map((set, index) => ({ set: clean(set), pieces: index === 0 ? 'Recommended' : 'Alternative', note: 'Recommendation from Game8.', source: url })),
    mainStats,
    teams: [],
    source: 'Game8',
    sourceKey: 'game8',
    sourceUrl: url,
    fetchedAt: Date.now(),
    materials: [],
    sourceLinks: [{ label: 'Game8', url }],
    quality: (weapons.length ? 2 : 0) + (artifacts.length ? 2 : 0) + (mainStats.sands ? 2 : 0) + (statPriority.length ? 1 : 0),
  };
}

async function readSource(url: string, signal?: AbortSignal): Promise<string> {
  const readerUrl = `https://r.jina.ai/${url}`;
  const timeout = AbortSignal.timeout(SOURCE_TIMEOUT_MS);
  const response = await fetch(readerUrl, {
    signal: signal ?? timeout,
    headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
  });
  if (!response.ok) throw new Error(`Source request failed (${response.status})`);
  const text = await response.text();
  if (text.length < 500) throw new Error('Source returned too little content.');
  return text;
}

function mergeSourceGuides(guides: ParsedSourceGuide[], slug: string): LivePlayerGuide {
  const ordered = [...guides].sort((a, b) => b.quality - a.quality);
  const primary = ordered.find((guide) => guide.sourceKey === 'genshinBuilds') ?? ordered[0];
  if (!primary) throw new Error('No usable source guide was returned.');

  const supplement = (field: keyof CharacterGuide) => ordered.find((guide) => guide !== primary && Array.isArray(guide[field]) && (guide[field] as unknown[]).length)?.[field] as never;
  const firstNonEmptyMainStat = (key: keyof LivePlayerGuide['mainStats']) => ordered.find((guide) => guide.mainStats[key])?.mainStats[key] ?? '';

  return {
    ...primary,
    characterId: slug,
    source: ordered.map((guide) => guide.source).join(' + '),
    sourceUrl: primary.sourceUrl,
    role: primary.role.length ? primary.role : (supplement('role') as string[] | undefined) ?? [],
    summary: primary.summary || ordered.find((guide) => guide.summary)?.summary || '',
    statPriority: primary.statPriority.length ? primary.statPriority : (supplement('statPriority') as string[] | undefined) ?? [],
    talentPriority: primary.talentPriority.length ? primary.talentPriority : (supplement('talentPriority') as string[] | undefined) ?? [],
    weapons: primary.weapons.length ? primary.weapons : (supplement('weapons') as LivePlayerGuide['weapons'] | undefined) ?? [],
    artifacts: primary.artifacts.length ? primary.artifacts : (supplement('artifacts') as LivePlayerGuide['artifacts'] | undefined) ?? [],
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

async function refreshGuide(cleanSlug: string, signal?: AbortSignal): Promise<LivePlayerGuide> {
  const jobs: Array<Promise<ParsedSourceGuide>> = [];

  const genshinBuildsUrl = SOURCES.genshinBuilds(cleanSlug);
  const icyVeinsUrl = SOURCES.icyVeins(cleanSlug);
  const game8Url = SOURCES.game8Search(cleanSlug);

  jobs.push(readSource(genshinBuildsUrl, signal).then((md) => parseGenshinBuilds(md, cleanSlug, genshinBuildsUrl)));
  jobs.push(readSource(icyVeinsUrl, signal).then((md) => parseIcyVeins(md, cleanSlug, icyVeinsUrl)));
  jobs.push(readSource(game8Url, signal).then((md) => parseGame8(md, cleanSlug, game8Url)));

  const results = await Promise.allSettled(jobs);
  const guides = results
    .filter((result): result is PromiseFulfilledResult<ParsedSourceGuide> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((guide) => guide.quality >= 3);

  if (!guides.length) {
    const kqmUrl = SOURCES.kqm(cleanSlug);
    try {
      const markdown = await readSource(kqmUrl, signal);
      guides.push(parseKqmFallback(markdown, cleanSlug, kqmUrl));
    } catch {
      // Preserve the cached guide if every live build source is unavailable.
    }
  }

  if (!guides.length) throw new Error('No usable maintained player-build source was available.');
  return mergeSourceGuides(guides, cleanSlug);
}

function refreshGuideOnce(cleanSlug: string): Promise<LivePlayerGuide> {
  const pending = guideRefreshes.get(cleanSlug);
  if (pending) return pending;
  const request = refreshGuide(cleanSlug)
    .finally(() => guideRefreshes.delete(cleanSlug));
  guideRefreshes.set(cleanSlug, request);
  return request;
}

function parseKqmFallback(markdown: string, slug: string, url: string): ParsedSourceGuide {
  const lines = markdownLines(markdown);
  const statLine = lines.find((line) => /(?:Sands|Goblet|Circlet)/i.test(line)) ?? '';
  return {
    characterId: slug,
    role: extractRole(lines),
    summary: extractIntro(lines),
    statPriority: extractStatsPriority(lines.find((line) => /substats?/i.test(line)) ?? ''),
    talentPriority: unique((lines.find((line) => /talent priority/i.test(line)) ?? '').split(/[:>]/).slice(1)).slice(0, 5),
    weapons: parseDelimitedNames(section(lines, [/^Weapons?$/i], [/^Artifacts?$/i, /^Team/i]), false, 8).map((name, index) => ({ name, tier: index === 0 ? 'Recommended' : `Option ${index + 1}`, note: 'Theorycrafting reference from KQM.', source: url })),
    artifacts: parseDelimitedNames(section(lines, [/^Artifacts?$/i], [/^Weapons?$/i, /^Team/i]), false, 8).map((set, index) => ({ set, pieces: index === 0 ? 'Recommended' : 'Alternative', note: 'Theorycrafting reference from KQM.', source: url })),
    mainStats: extractMainStats(statLine),
    teams: [],
    source: 'KQM',
    sourceKey: 'kqm',
    sourceUrl: url,
    fetchedAt: Date.now(),
    materials: [],
    sourceLinks: [{ label: 'KQM', url }],
    quality: 3,
  };
}

export async function fetchPlayerGuide(slug: string, signal?: AbortSignal): Promise<LivePlayerGuide> {
  const cleanSlug = slugify(slug);
  const cacheKey = `player-guide:${cleanSlug}:v4`;
  const cached = readCache<LivePlayerGuide>(cacheKey);

  // Use persistent cached data immediately and refresh it in the background.
  if (cached && !cached.stale) return cached.value;
  if (cached && Date.now() - (cached.value.fetchedAt ?? 0) < STALE_REVALIDATE_TTL) {
    void refreshGuideOnce(cleanSlug).then((fresh) => writeCache(cacheKey, fresh, CACHE_TTL)).catch(() => undefined);
    return cached.value;
  }

  const fresh = await refreshGuideOnce(cleanSlug);
  writeCache(cacheKey, fresh, CACHE_TTL);
  return fresh;
}
