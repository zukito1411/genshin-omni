import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dist = join(root, 'dist');
const port = Number(process.env.PORT || 10000);
const cache = new Map();
const CACHE_MS = 6 * 60 * 60 * 1000;
const IMAGE_CACHE_MS = 24 * 60 * 60 * 1000;
const upstreamHeaders = {
  'User-Agent': 'TeyvatAtlas/1.0 (+player companion; source attribution shown in app)',
  'Accept': 'text/html,application/xhtml+xml,application/json,image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

function now() { return Date.now(); }

async function cachedFetch(url, ttl = CACHE_MS) {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > now()) return hit.value;

  const response = await fetch(url, { headers: upstreamHeaders, redirect: 'follow' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const value = await response.arrayBuffer();
  cache.set(url, { value, expiresAt: now() + ttl, contentType: response.headers.get('content-type') || 'application/octet-stream' });
  return { value, contentType: response.headers.get('content-type') || 'application/octet-stream' };
}

async function cachedFetchText(url, ttl = CACHE_MS) {
  const result = await cachedFetch(url, ttl);
  return new TextDecoder().decode(result.value);
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function htmlToLines(html) {
  const prepared = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Keep image alt text because Genshin.gg puts useful entity names in image alt attributes.
    .replace(/<img\b[^>]*\balt=["']([^"']+)["'][^>]*>/gi, '\n$1\n')
    .replace(/<br\s*\/?>(?:)/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/div>/gi, '\n');

  const withoutTags = prepared.replace(/<[^>]+>/g, ' ');
  return decodeEntities(withoutTags)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function cleanLines(lines) {
  const output = [];
  for (const line of lines) {
    if (/^Image:\s*/i.test(line)) continue;
    if (output.at(-1) === line) continue;
    output.push(line);
  }
  return output;
}

function section(lines, startText, endTexts = []) {
  const start = lines.findIndex((line) => line.toLowerCase() === startText.toLowerCase());
  if (start < 0) return [];
  let end = lines.length;
  for (const endText of endTexts) {
    const candidate = lines.findIndex((line, index) => index > start && line.toLowerCase() === endText.toLowerCase());
    if (candidate >= 0) end = Math.min(end, candidate);
  }
  return lines.slice(start + 1, end);
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }

function slugify(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeName(value) {
  return value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractImageUrl(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<img[^>]+alt=[\\"']${escaped}[\\"'][^>]+src=[\\"']([^\\"']+)`, 'i'))
    || html.match(/<img[^>]+src=[\\"']([^\\"']+)[\\"'][^>]+alt=[\\"'][^\\"']+/i);
  return match?.[1] || '';
}

function parseRankedNames(lines, max = 5) {
  const names = [];
  for (const line of lines) {
    if (/^\d+$/.test(line) || /^R\d+$/i.test(line) || /^\d+★?$/.test(line)) continue;
    if (/^Sands:|^Goblet:|^Circlet:|^Substats:/i.test(line)) continue;
    if (line.length < 2 || line.length > 80) continue;
    if (/^(Best|Upgrade|Cost|Material|Rank|Lvl|Image|Main Stat Usage|Most Used Artifact Sets)$/i.test(line)) continue;
    if (/^[\d.,%+\-/ ]+$/.test(line)) continue;
    names.push(line);
  }
  return unique(names).slice(0, max);
}

function parseTeamMembers(lines, rosterNames) {
  const known = new Map(rosterNames.map((name) => [normalizeName(name), name]));
  const members = [];
  for (const line of lines) {
    const canonical = known.get(normalizeName(line));
    if (canonical && !members.includes(canonical)) members.push(canonical);
    if (members.length >= 4) break;
  }
  return members;
}

function parseTeamSection(lines, rosterNames, characterName) {
  const teams = [];
  let i = 0;
  while (i < lines.length && teams.length < 6) {
    const title = lines[i];
    const window = lines.slice(i + 1, i + 14);
    const members = parseTeamMembers(window, rosterNames);
    if (members.length >= 2 && members.some((name) => normalizeName(name) === normalizeName(characterName))) {
      teams.push({
        name: title,
        members,
        note: `${characterName} team listed by the live build source.`,
        source: 'https://genshin.gg/teams/',
      });
      i += Math.max(2, window.findIndex((line) => normalizeName(line) === normalizeName(members.at(-1) || '')) + 2);
    } else {
      i += 1;
    }
  }
  return teams;
}


function parseAscensionMaterials(lines, characterName, sourceUrl) {
  const start = lines.findIndex((line) => line.toLowerCase() === `${characterName.toLowerCase()} ascension costs`);
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && /^(Loading|$)/i.test(line));
  const rows = lines.slice(start + 1, end > start ? end : Math.min(lines.length, start + 180));
  const totals = new Map();
  let i = 0;
  while (i < rows.length) {
    if (!/^[1-6]$/.test(rows[i]) || !/^(20|40|50|60|70|80)$/.test(rows[i + 1] || '')) { i += 1; continue; }
    // Skip rank, level, and Mora cost. The remaining values are quantity/name pairs.
    i += 3;
    while (i + 1 < rows.length && !(/^[1-6]$/.test(rows[i]) && /^(20|40|50|60|70|80)$/.test(rows[i + 1] || ''))) {
      const quantity = Number(rows[i]);
      const name = rows[i + 1];
      if (Number.isFinite(quantity) && quantity > 0 && name && !/^\d+$/.test(name)) {
        totals.set(name, (totals.get(name) || 0) + quantity);
        i += 2;
      } else {
        i += 1;
      }
    }
  }
  return [...totals.entries()].map(([name, amount]) => ({ name, amount, source: sourceUrl, category: 'Character Ascension' }));
}

function parseGenshinCharacterPage(html, slug, rosterNames) {
  const lines = cleanLines(htmlToLines(html));
  const heading = lines.find((line) => /^Genshin Impact .* Build$/i.test(line)) || '';
  const characterName = heading.replace(/^Genshin Impact /i, '').replace(/ Build$/i, '') || slug;
  const role = lines.find((line) => /^(Main DPS|Sub DPS|Support|DPS)$/i.test(line)) || '';

  const weaponSection = section(lines, `${characterName} Best Weapons`, ['Best Artifacts']);
  const artifactSection = section(lines, `${characterName} Best Artifacts`, ['Best Stats']);
  const statsSection = section(lines, `${characterName} Best Stats`, ['Showcase', 'Teams']);
  const teamSection = section(lines, `Best ${characterName} Teams`, ['Talents']);
  const materialSection = section(lines, `${characterName} Upgrade Materials`, ['Best Weapons']);

  const stats = {};
  for (const line of statsSection) {
    const match = line.match(/^(Sands|Goblet|Circlet|Substats):\s*(.+)$/i);
    if (match) stats[match[1].toLowerCase()] = match[2];
  }

  const weapons = parseRankedNames(weaponSection).filter((name) => !['Pyro','Cryo','Hydro','Electro','Anemo','Geo','Dendro'].includes(name));
  const artifacts = parseRankedNames(artifactSection).filter((name) => !/^\d+$/.test(name));
  const materialNames = parseRankedNames(materialSection, 40).filter((name) => !/^(Rank|Lvl|Cost|Material)$/i.test(name));
  const sourceUrl = `https://genshin.gg/characters/${encodeURIComponent(slug)}/`;
  const ascensionMaterials = parseAscensionMaterials(lines, characterName, sourceUrl);
  const teams = parseTeamSection(teamSection, rosterNames, characterName);

  return {
    source: 'Genshin.gg',
    sourceUrl,
    imageUrl: extractImageUrl(html, characterName),
    fetchedAt: now(),
    characterId: slug,
    summary: role ? `${role} build and progression reference compiled from current public build data.` : 'Current player build and progression reference compiled from public game and build data.',
    talentPriority: [],
    role: role ? [role] : [],
    weapons: weapons.map((name, index) => ({ name, tier: index === 0 ? 'Top recommendation' : `Option ${index + 1}`, note: 'Current recommendation from Genshin.gg.', source: `https://genshin.gg/characters/${encodeURIComponent(slug)}/` })),
    artifacts: artifacts.map((set, index) => ({ set, pieces: 'Recommended', note: index === 0 ? 'Primary current recommendation.' : 'Alternative current recommendation.', source: `https://genshin.gg/characters/${encodeURIComponent(slug)}/` })),
    mainStats: { sands: stats.sands || 'See source', goblet: stats.goblet || 'See source', circlet: stats.circlet || 'See source' },
    statPriority: stats.substats ? [stats.substats] : [],
    teams,
    materials: ascensionMaterials.length ? ascensionMaterials : materialNames.map((name) => ({ name, source: sourceUrl, category: 'Character Ascension' })),
  };
}

async function fetchRosterNames() {
  const url = 'https://genshin-db-api.vercel.app/api/v5/characters?query=names&matchCategories=true&verboseCategories=true&resultLanguage=english';
  const response = await fetch(url, { headers: { ...upstreamHeaders, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = await response.json();
  const result = payload?.result ?? payload;
  const values = Array.isArray(result) ? result : Object.values(result || {});
  return values.map((item) => typeof item === 'string' ? item : item?.name || item?.displayName).filter(Boolean);
}

async function fetchGuide(slug, rosterNames = []) {
  const safe = slugify(slug);
  const genshinUrl = `https://genshin.gg/characters/${encodeURIComponent(safe)}/`;
  try {
    const html = await cachedFetchText(genshinUrl);
    return parseGenshinCharacterPage(html, safe, rosterNames);
  } catch {
    const prydwenUrl = `https://www.prydwen.gg/genshin-impact/characters/${encodeURIComponent(safe)}`;
    try {
      const html = await cachedFetchText(prydwenUrl);
      const lines = cleanLines(htmlToLines(html));
      const role = lines.find((line) => /^(Main DPS|Sub DPS|Support|DPS)$/i.test(line)) || '';
      const weaponStart = lines.findIndex((line) => /^Weapons$/i.test(line));
      const artifactStart = lines.findIndex((line) => /^Artifacts$/i.test(line));
      const statsStart = lines.findIndex((line) => /^Sands$/i.test(line));
      const weapons = weaponStart >= 0 ? parseRankedNames(lines.slice(weaponStart + 1, artifactStart >= 0 ? artifactStart : weaponStart + 25), 5) : [];
      const artifacts = artifactStart >= 0 ? parseRankedNames(lines.slice(artifactStart + 1, statsStart >= 0 ? statsStart : artifactStart + 25), 5) : [];
      const mainStats = { sands: '', goblet: '', circlet: '' };
      for (const line of lines.slice(statsStart >= 0 ? statsStart : 0, (statsStart >= 0 ? statsStart : 0) + 35)) {
        const match = line.match(/^(Sands|Goblet|Circlet)\s*:??\s*(.*)$/i);
        if (match) mainStats[match[1].toLowerCase()] = match[2].trim();
      }
      return {
        source: 'Prydwen', sourceUrl: prydwenUrl, imageUrl: extractImageUrl(html, safe), fetchedAt: now(),
        role: role ? [role] : [],
        weapons: weapons.map((name, index) => ({ name, tier: `Observed option ${index + 1}`, note: 'Current community build data from Prydwen.', source: prydwenUrl })),
        artifacts: artifacts.map((name) => ({ set: name, pieces: 'Observed', note: 'Current community build data from Prydwen.', source: prydwenUrl })),
        mainStats, statPriority: [], teams: [], materials: [],
      };
    } catch {
      return { source: 'Unavailable', sourceUrl: '', imageUrl: '', fetchedAt: now(), role: [], weapons: [], artifacts: [], mainStats: { sands: '', goblet: '', circlet: '' }, statPriority: [], teams: [], materials: [] };
    }
  }
}

function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

async function proxyJson(req, res, target) {
  try {
    const result = await cachedFetch(target);
    json(res, 200, JSON.parse(new TextDecoder().decode(result.value)), { 'Cache-Control': 'public, max-age=300' });
  } catch (error) {
    json(res, 502, { error: error instanceof Error ? error.message : 'Upstream request failed.' });
  }
}

async function proxyImage(res, target) {
  try {
    const result = await cachedFetch(target, IMAGE_CACHE_MS);
    res.writeHead(200, { 'Content-Type': result.contentType, 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' });
    res.end(Buffer.from(result.value));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Image unavailable');
  }
}

async function serveStatic(req, res) {
  if (!existsSync(dist)) return false;
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (pathname === '/') pathname = '/index.html';
  const candidate = normalize(join(dist, pathname));
  if (!candidate.startsWith(normalize(dist))) return false;
  try {
    const info = await stat(candidate);
    if (!info.isFile()) return false;
    const data = await readFile(candidate);
    const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'Content-Type': contentTypes[extname(candidate)] || 'application/octet-stream' });
    res.end(data);
    return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, app: 'Teyvat Atlas', time: new Date().toISOString() });

    if (url.pathname.startsWith('/api/genshin-db/')) {
      const folder = url.pathname.replace('/api/genshin-db/', '').replace(/\/$/, '');
      if (!/^[a-z0-9-]+$/i.test(folder)) return json(res, 400, { error: 'Invalid GenshinDB folder.' });
      const target = `https://genshin-db-api.vercel.app/api/v5/${folder}${url.search}`;
      return proxyJson(req, res, target);
    }

    if (url.pathname.startsWith('/api/genshin-dev/')) {
      const path = url.pathname.replace('/api/genshin-dev', '');
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
      if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(path) || /\/(icon|card|portrait|gacha-card|namecard)$/i.test(path)) return proxyImage(res, `https://genshin.jmp.blue${path}${url.search}`);
      return proxyJson(req, res, `https://genshin.jmp.blue${path}${url.search}`);
    }

    if (url.pathname === '/api/player/guide') {
      const slug = url.searchParams.get('slug');
      if (!slug) return json(res, 400, { error: 'Missing character slug.' });
      let rosterNames = [];
      try { rosterNames = await fetchRosterNames(); } catch {}
      const guide = await fetchGuide(slug, rosterNames);
      return json(res, 200, guide, { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=21600' });
    }

    if (url.pathname === '/api/player/guide-all') {
      const slugs = (url.searchParams.get('slugs') || '').split(',').map((item) => item.trim()).filter(Boolean);
      const results = {};
      let rosterNames = [];
      try { rosterNames = await fetchRosterNames(); } catch {}
      for (const slug of slugs.slice(0, 150)) results[slug] = await fetchGuide(slug, rosterNames);
      return json(res, 200, { generatedAt: new Date().toISOString(), guides: results });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
    if (await serveStatic(req, res)) return;
    if (existsSync(join(dist, 'index.html'))) {
      const data = await readFile(join(dist, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(data);
    }
    res.writeHead(404); res.end('Not found');
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : 'Server error.' });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Teyvat Atlas listening on ${port}`));
