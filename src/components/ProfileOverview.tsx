import { Crown, ExternalLink, Globe2, Shield, Swords, Trophy, Users } from 'lucide-react';
import type { EnkaMetadata, EnkaProfile } from '../types/enka';
import { namecardImage, profileImage, regionFromUid } from '../utils/enka';
import { AsyncImage } from './AsyncImage';
import { AssetPlaceholder } from './AssetPlaceholder';

export function ProfileOverview({ profile, metadata, uid }: { profile: EnkaProfile; metadata: EnkaMetadata | null; uid: string }) {
  const player = profile.playerInfo;
  const bannerId = player.nameCardId ?? player.namecardId;
  const namecards = [...new Set(player.showNameCardIdList ?? [])].slice(0, 8);
  const abyss = player.towerFloorIndex && player.towerLevelIndex ? `${player.towerFloorIndex}–${player.towerLevelIndex}` : '—';
  const metrics = [
    { label: 'Adventure Rank', value: player.level ?? '—', icon: Crown },
    { label: 'World Level', value: player.worldLevel ?? '—', icon: Shield },
    { label: 'Server', value: profile.region ?? regionFromUid(uid), icon: Globe2 },
    { label: 'Shared builds', value: profile.avatarInfoList?.length ?? 0, icon: Users },
  ];

  return <>
    <section className="profile-banner panel">
      <AsyncImage src={namecardImage(bannerId, metadata)} alt="" className="profile-banner__background" fallback={null} loading="eager" />
      <div className="profile-banner__content">
        <div className="profile-avatar-frame"><AsyncImage src={profileImage(profile, metadata)} alt={`${player.nickname || 'Traveler'} profile avatar`} className="profile-avatar" fallback={<AssetPlaceholder kind="character" />} loading="eager" /></div>
        <div className="profile-banner__copy"><div className="eyebrow">PUBLIC PLAYER PROFILE</div><h2>{player.nickname || 'Traveler'}</h2><p>{player.signature || 'Ready for the next adventure.'}</p><span className="profile-uid">UID <code>{uid}</code></span></div>
        <a className="button secondary" href={`https://enka.network/u/${uid}/`} target="_blank" rel="noreferrer">View on Enka <ExternalLink size={14} /></a>
      </div>
    </section>
    <section className="profile-metrics profile-metrics--overview" aria-label="Player stats">
      {metrics.map(({ label, value, icon: Icon }) => <article key={label}><Icon size={20} /><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    <section className="profile-progress-grid" aria-label="Player progress">
      <article className="panel profile-progress-card profile-progress-card--achievements"><div className="profile-progress-card__icon"><Trophy size={30} /></div><div><div className="eyebrow">ACHIEVEMENTS</div><h3>{player.finishAchievementNum === undefined ? '—' : player.finishAchievementNum.toLocaleString()}</h3><strong>Achievements completed</strong><p>The shared achievement total. Individual unlocks are not available through a public UID.</p></div></article>
      <article className="panel profile-progress-card"><div className="profile-progress-card__icon"><Swords size={30} /></div><div><div className="eyebrow">SPIRAL ABYSS</div><h3>{abyss}</h3><strong>{abyss === '—' ? 'No floor record shared' : 'Floor & chamber record'}</strong><p>{player.towerStarIndex === undefined ? 'The floor and chamber reported by the public profile.' : `${player.towerStarIndex} stars reported by the profile.`}</p></div></article>
    </section>
    {namecards.length > 0 && <section className="profile-namecards"><div className="eyebrow">PUBLIC NAMECARDS</div><div className="profile-namecards__grid">{namecards.map((id, index) => <AsyncImage key={id} src={namecardImage(id, metadata)} alt={`Featured namecard ${index + 1}`} className="profile-namecard-preview" fallback={null} />)}</div></section>}
  </>;
}
