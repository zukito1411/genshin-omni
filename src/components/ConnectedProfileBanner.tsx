import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ShieldCheck, UserRound } from 'lucide-react';
import { AsyncImage } from './AsyncImage';
import { gameImageSources } from '../api/assets';
import { retryImageSources } from '../api/imageLoader';
import { MyProfileError, myProfileRequest } from '../api/myProfile';
import type { ConnectedRole, ProfileArtwork } from '../types/myProfile';

export function ConnectedProfileBanner({ role, csrf, onExpired }: { role: ConnectedRole; csrf: string; onExpired: () => void }) {
  const [artwork, setArtwork] = useState<ProfileArtwork | null>(null);
  const [settled, setSettled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const expired = useRef(onExpired); expired.current = onExpired;
  useEffect(() => {
    const controller = new AbortController();
    setSettled(false); setImageFailed(false);
    void myProfileRequest<{ artwork: ProfileArtwork }>('POST', { action: 'artwork', uid: role.uid }, csrf, controller.signal).then((result) => {
      if (controller.signal.aborted || result.artwork?.uid !== role.uid || typeof result.artwork.avatar !== 'string' || typeof result.artwork.namecard !== 'string') return;
      setArtwork((previous) => ({ ...result.artwork, avatar: result.artwork.avatar || previous?.avatar || '', namecard: result.artwork.namecard || previous?.namecard || '' }));
    }).catch((error) => {
      if (!controller.signal.aborted && error instanceof MyProfileError && error.code === 'reconnect') expired.current();
    }).finally(() => { if (!controller.signal.aborted) setSettled(true); });
    return () => controller.abort();
  }, [role.uid, csrf, attempt]);
  const avatar = gameImageSources(artwork?.avatar);
  const namecard = gameImageSources(artwork?.namecard);
  async function copyUid() {
    try { await navigator.clipboard.writeText(role.uid); setCopyState('copied'); }
    catch { setCopyState('failed'); }
  }
  return <>
    <section className="profile-banner panel connected-profile-banner" aria-busy={!settled}>
      {namecard.length > 0 && <AsyncImage key={`namecard-${attempt}`} src={namecard} alt="" className="profile-banner__background" fallback={null} loading="eager" onUnavailable={() => setImageFailed(true)} />}
      <div className="profile-banner__content">
        <div className="profile-avatar-frame"><AsyncImage key={`avatar-${attempt}`} src={avatar} alt={`${role.nickname} profile avatar`} className="profile-avatar" fallback={<UserRound size={42} aria-hidden="true" />} loading="eager" onUnavailable={() => setImageFailed(true)} /></div>
        <div className="profile-banner__copy"><div className="eyebrow">MY CONNECTED PROFILE</div><h2>{role.nickname}</h2><p className="connected-profile-banner__meta"><span>{role.server}</span><span>Adventure Rank {typeof role.level === 'number' ? role.level.toLocaleString() : '—'}</span></p><div className="connected-profile-banner__badges"><button type="button" className="profile-uid" aria-label="Copy UID" onClick={() => void copyUid()}><span>UID <code>{role.uid}</code></span>{copyState === 'copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}</button><span className="pill"><ShieldCheck size={13} aria-hidden="true" />Private connection</span></div><span role="status" className="profile-copy-status">{copyState === 'copied' ? 'UID copied.' : copyState === 'failed' ? 'Could not copy. You can select the UID instead.' : ''}</span></div>
      </div>
    </section>
    {settled && (!avatar.length || !namecard.length || imageFailed) && <p className="muted">Some profile artwork is unavailable. Your account details are still shown. <button type="button" className="text-button" onClick={() => { retryImageSources([...avatar, ...namecard]); setAttempt((value) => value + 1); }}>Retry artwork</button></p>}
  </>;
}
