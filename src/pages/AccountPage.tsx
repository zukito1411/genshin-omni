import { useState, type FormEvent } from 'react';
import { ExternalLink, UserRound } from 'lucide-react';
import { fetchEnkaByUid } from '../api/enka';
import { SectionTitle } from '../components/SectionTitle';
import { entityImage } from '../api/genshinDev';

export function AccountPage() {
  const [uid, setUid] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(null); try { setData(await fetchEnkaByUid(uid)); } catch (err) { setError(err instanceof Error ? err.message : 'Enka lookup failed.'); } finally { setLoading(false); } }
  const player = data?.playerInfo;
  const avatars = Array.isArray(data?.avatarInfoList) ? data.avatarInfoList : [];
  return <div><SectionTitle eyebrow="OPTIONAL ACCOUNT TOOL" title="Public UID Build Lookup" description="Enka.Network exposes public showcase data without requiring your game password. This app reads it client-side and does not store it on a server." /><form className="lookup-form" onSubmit={submit}><input value={uid} onChange={(e) => setUid(e.target.value)} inputMode="numeric" placeholder="9-digit Genshin UID" /><button className="button primary" disabled={loading}>{loading ? 'Loading…' : 'Lookup'}</button></form>{error && <div className="error-box"><strong>Lookup failed.</strong><p>{error}</p><a href="https://enka.network/" target="_blank" rel="noreferrer" className="source-button">Open Enka.Network <ExternalLink size={13} /></a></div>}{player && <><section className="profile-summary panel"><div className="profile-icon"><UserRound /></div><div><div className="eyebrow">PUBLIC PROFILE</div><h2>{player.nickname ?? 'Traveler'}</h2><p>Adventure Rank {player.level ?? '—'} · World Level {player.worldLevel ?? '—'}</p></div></section><div className="showcase-grid">{avatars.map((avatar: any, index: number) => { const id = String(avatar.avatarId ?? avatar.id ?? index); return <article className="showcase-card" key={`${id}-${index}`}><img src={entityImage('characters', id, 'icon')} alt="" onError={(e) => e.currentTarget.style.visibility='hidden'} /><div><strong>Avatar {id}</strong><span>Level {avatar.propMap?.['1001']?.val ?? '—'}</span></div></article>; })}</div></>}</div>;
}
