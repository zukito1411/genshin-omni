import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';
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
  return <>
    <section className="profile-banner panel connected-profile-banner">
      {namecard.length > 0 && <AsyncImage key={`namecard-${attempt}`} src={namecard} alt="" className="profile-banner__background" fallback={null} loading="eager" onUnavailable={() => setImageFailed(true)} />}
      <div className="profile-banner__content">
        <div className="profile-avatar-frame"><AsyncImage key={`avatar-${attempt}`} src={avatar} alt={`${role.nickname} profile avatar`} className="profile-avatar" fallback={<UserRound size={42} aria-hidden="true" />} loading="eager" onUnavailable={() => setImageFailed(true)} /></div>
        <div className="profile-banner__copy"><div className="eyebrow">MY CONNECTED PROFILE</div><h2>{role.nickname}</h2><p>{role.server} · UID {role.uid} · Adventure Rank {typeof role.level === 'number' ? role.level.toLocaleString() : '—'}</p><span className="pill"><ShieldCheck size={13} />Private connection</span></div>
      </div>
    </section>
    {settled && (!avatar.length || !namecard.length || imageFailed) && <p className="muted">Some profile artwork is unavailable. Your account details are still shown. <button type="button" className="text-button" onClick={() => { retryImageSources([...avatar, ...namecard]); setAttempt((value) => value + 1); }}>Retry artwork</button></p>}
  </>;
}
