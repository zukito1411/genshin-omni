import { useMemo, useState, type FormEvent } from 'react';
import { Check, ExternalLink, UserRound } from 'lucide-react';
import { fetchEnkaByUid } from '../api/enka';
import { assetKey, characterImageSources, entityImage } from '../api/genshinDev';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { useCharacters } from '../hooks/useCharacters';
import { readOwnedCharacterIds, writeOwnedCharacterIds } from '../utils/playerData';
import type { GenshinCharacter } from '../types/genshin';

const PROFILE_UID_KEY = 'teyvat-atlas:profile-uid:v1';
type ShowcaseAvatar = { avatarId?: string | number; avatarID?: string | number; id?: string | number; propMap?: Record<string, { val?: string | number }> };
type PublicProfile = {
  region?: string;
  playerInfo?: {
    nickname?: string;
    signature?: string;
    level?: number;
    worldLevel?: number;
    finishAchievementNum?: number;
    towerFloorIndex?: number;
    towerLevelIndex?: number;
  };
  avatarInfoList?: ShowcaseAvatar[];
};

function savedUid(): string {
  try { return localStorage.getItem(PROFILE_UID_KEY) ?? ''; } catch { return ''; }
}

function regionFromUid(uid: string): string {
  const first = uid.trim().charAt(0);
  return ({ '6': 'America', '7': 'Europe', '8': 'Asia', '9': 'TW / HK / MO' } as Record<string, string>)[first] ?? 'Not available';
}

export function AccountPage() {
  const { allCharacters, loading: rosterLoading } = useCharacters('');
  const [uid, setUid] = useState(savedUid);
  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [ownedIds, setOwnedIds] = useState(readOwnedCharacterIds);
  const owned = new Set(ownedIds);
  const visibleCharacters = useMemo(() => allCharacters.filter((character) => !query || character.name.toLowerCase().includes(query.toLowerCase())).slice(0, 80), [allCharacters, query]);
  const player = data?.playerInfo;
  const avatars: ShowcaseAvatar[] = Array.isArray(data?.avatarInfoList) ? data.avatarInfoList : [];
  const showcaseCharacters = useMemo(() => avatars.map((avatar, index) => {
    const avatarId = String(avatar.avatarId ?? avatar.avatarID ?? avatar.id ?? index);
    return { avatar, avatarId, character: allCharacters.find((entry) => String(entry.gameId ?? '') === avatarId) };
  }), [avatars, allCharacters]);

  function toggleOwned(id: string) {
    const next = owned.has(id) ? ownedIds.filter((item) => item !== id) : [...ownedIds, id];
    setOwnedIds(next);
    writeOwnedCharacterIds(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cleanUid = uid.replace(/\D/g, '');
      setData(await fetchEnkaByUid(cleanUid) as PublicProfile);
      try { localStorage.setItem(PROFILE_UID_KEY, cleanUid); } catch { /* Storage is optional. */ }
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Enka lookup failed.'); }
    finally { setLoading(false); }
  }

  function addShowcaseToRoster() {
    const matched = showcaseCharacters.flatMap(({ character }: { character?: GenshinCharacter }) => character ? [character.id] : []);
    if (!matched.length) return;
    const next = [...new Set([...ownedIds, ...matched])];
    setOwnedIds(next);
    writeOwnedCharacterIds(next);
  }

  return <div>
    <SectionTitle eyebrow="MY ACCOUNT" title="My Roster" description="Track characters you own on this device, then optionally look up a public Enka showcase. Teyvat Atlas never asks for your game password; if Enka blocks browser access, the public UID is retried through its reader service." />
    <section className="roster-summary panel"><div><div className="eyebrow">LOCAL ROSTER</div><h2>{ownedIds.length} characters marked owned</h2><p>Your roster, teams, and farming checks remain in this browser’s local storage.</p></div><UserRound size={34} /></section>
    <section className="panel roster-picker"><div className="plan-output-head"><div><div className="eyebrow">OWNERSHIP</div><h3>Mark your characters</h3></div><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your roster" /></div>{rosterLoading ? <div className="loading">Loading roster…</div> : <div className="roster-character-list">{visibleCharacters.map((character) => <button type="button" key={character.id} className={owned.has(character.id) ? 'owned' : ''} onClick={() => toggleOwned(character.id)} aria-pressed={owned.has(character.id)}><AsyncImage src={characterImageSources(character, 'icon')} alt="" className="roster-character-list__image" assetKey={assetKey('characters', character.id)} /><span><strong>{character.name}</strong><small>{character.element} · {character.weapon}</small></span>{owned.has(character.id) && <Check size={17} />}</button>)}</div>}</section>
    <section className="section-block"><SectionTitle eyebrow="OPTIONAL IMPORT" title="Public UID showcase" description="A UID can load only the public showcase the player has enabled. It cannot reveal a complete private roster or Battle Chronicle data." /><form className="lookup-form" onSubmit={submit}><input value={uid} onChange={(event) => setUid(event.target.value)} inputMode="numeric" placeholder="9-digit Genshin UID" /><button className="button primary" disabled={loading}>{loading ? 'Loading…' : 'Lookup'}</button></form>{error && <div className="error-box"><strong>Lookup failed.</strong><p>{error}</p><a href="https://enka.network/" target="_blank" rel="noreferrer" className="source-button">Open Enka.Network <ExternalLink size={13} /></a></div>}{player && <><section className="profile-summary panel"><div className="profile-icon"><UserRound /></div><div><div className="eyebrow">PUBLIC PROFILE</div><h2>{player.nickname ?? 'Traveler'}</h2><p>{player.signature || 'No public signature.'}</p></div>{avatars.length > 0 && <button className="button secondary" type="button" onClick={addShowcaseToRoster}>Add matched showcase characters</button>}</section><section className="profile-metrics"><article><span>Adventure Rank</span><strong>{player.level ?? '—'}</strong></article><article><span>World Level</span><strong>{player.worldLevel ?? '—'}</strong></article><article><span>Server</span><strong>{data.region ?? regionFromUid(uid)}</strong></article><article><span>Achievements</span><strong>{player.finishAchievementNum ?? '—'}</strong></article><article><span>Spiral Abyss</span><strong>{player.towerFloorIndex && player.towerLevelIndex ? `${player.towerFloorIndex}-${player.towerLevelIndex}` : '—'}</strong></article></section>{avatars.length ? <div className="showcase-grid">{showcaseCharacters.map(({ avatar, avatarId, character }, index) => <article className="showcase-card" key={`${avatarId}-${index}`}>{character ? <AsyncImage src={characterImageSources(character, 'icon')} alt="" className="showcase-card__image" assetKey={assetKey('characters', character.id)} /> : <img src={entityImage('characters', avatarId, 'icon')} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />}<div><strong>{character?.name ?? `Avatar ${avatarId}`}</strong><span>Level {avatar.propMap?.['4001']?.val ?? avatar.propMap?.['1001']?.val ?? '—'}</span></div></article>)}</div> : <div className="empty-state">This player has no public character showcase. Enable “Show Character Details” in-game, then try again.</div>}</>}</section>
  </div>;
}
