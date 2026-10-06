import { memo, useDeferredValue, useId, useMemo } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, Clock, Compass, Droplets, Flame, Gem, Search, Sparkles, Swords, Trophy, UsersRound } from 'lucide-react';
import { SectionTitle } from './SectionTitle';
import { ProfileImage } from './ProfileImage';
import { AssetPlaceholder } from './AssetPlaceholder';
import { ConnectedProfileBanner } from './ConnectedProfileBanner';
import { Link } from 'react-router-dom';
import type { PrivateCharacter, PrivateProfile, ProfileRosterView } from '../types/myProfile';

const value = (number: number | null | undefined) => number == null ? '—' : number.toLocaleString();
function duration(seconds: number | null) {
  if (seconds === null) return 'Time unavailable';
  if (seconds === 0) return 'Ready';
  const minutes = Math.ceil(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}
const OwnedCharacterCard = memo(function OwnedCharacterCard({ entry, uid }: { entry: PrivateCharacter; uid: string }) {
  return <Link className={`showcase-card showcase-card--link profile-owned-card rarity-${entry.rarity ?? 0}`} to={`/me/${uid}/characters/${entry.id}`}>
    <ProfileImage src={entry.icon} alt="" className="showcase-card__image" fallback={<AssetPlaceholder kind="character" />} />
    <div><strong>{entry.name}</strong><span>{entry.element || 'Element unavailable'} · Level {value(entry.level)} · C{value(entry.constellation)}</span><span className="profile-owned-card__hint">View equipped build <ArrowRight size={13} aria-hidden="true" /></span></div>
  </Link>;
});
function ExplorationCard({ entry }: { entry: PrivateProfile['exploration'][number] }) {
  return <article className="panel profile-region-card">
    {Boolean(entry.artwork?.length) && <ProfileImage src={entry.artwork ?? []} alt="" className="profile-region-card__artwork" fallback={null} />}
    <div className="profile-region-card__head"><ProfileImage src={entry.icons?.length ? entry.icons : entry.icon} alt="" className="talent-icon" fallback={<AssetPlaceholder kind="material" />} /><div><h3>{entry.name}</h3><span className="muted">Exploration</span></div><strong>{entry.percentage === null ? '—' : `${entry.percentage}%`}</strong></div>
    {entry.percentage !== null && <progress className="profile-capacity" max={100} value={Math.min(100, entry.percentage)} aria-label={`${entry.name} exploration`} />}
    {entry.level !== null && entry.level > 0 && <p className="profile-region-card__level">Region level {value(entry.level)}</p>}
    {Boolean(entry.offerings?.length) && <details className="profile-region-card__details"><summary>Regional progress <ChevronDown size={15} aria-hidden="true" /></summary><ul>{entry.offerings?.map((offering, index) => <li key={index}><ProfileImage src={offering.icon} alt="" className="talent-icon" fallback={<AssetPlaceholder kind="material" />} /><span>{offering.name}</span><strong>Level {value(offering.level)}</strong></li>)}</ul></details>}
  </article>;
}

export function ConnectedProfileOverview({ profile, characters: roster, rosterView, onRosterViewChange, csrf, onExpired }: { profile: PrivateProfile; characters: PrivateCharacter[]; rosterView: ProfileRosterView; onRosterViewChange: (view: ProfileRosterView) => void; csrf: string; onExpired: () => void }) {
  const { search, element, sort } = rosterView;
  const deferredSearch = useDeferredValue(search);
  const id = useId();
  const elements = useMemo(() => [...new Set(roster.map((entry) => entry.element).filter(Boolean))].sort(), [roster]);
  const characters = useMemo(() => {
    const filtered = roster.filter((entry) => entry.name.toLowerCase().includes(deferredSearch.trim().toLowerCase()) && (!element || entry.element === element));
    if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'level') filtered.sort((a, b) => (b.level ?? -1) - (a.level ?? -1) || a.name.localeCompare(b.name));
    if (sort === 'rarity') filtered.sort((a, b) => (b.rarity ?? -1) - (a.rarity ?? -1) || (b.level ?? -1) - (a.level ?? -1) || a.name.localeCompare(b.name));
    return filtered;
  }, [roster, deferredSearch, element, sort]);
  const notes = profile.notes;
  const jumps = [{ key: 'overview', label: 'Overview', icon: Trophy }, { key: 'daily', label: 'Daily notes', icon: Droplets }, { key: 'characters', label: 'Characters', icon: UsersRound }, { key: 'exploration', label: 'Exploration', icon: Compass }];
  function jump(key: string) {
    const section = document.getElementById(`${id}-${key}`);
    section?.scrollIntoView({ block: 'start', behavior: 'instant' });
    section?.focus({ preventScroll: true });
  }
  const metrics = [
    { label: 'Achievements', amount: profile.stats.achievements, icon: Trophy },
    { label: 'Days active', amount: profile.stats.daysActive, icon: CalendarDays },
    { label: 'Characters', amount: profile.stats.characters, icon: UsersRound },
    { label: 'Spiral Abyss', amount: profile.stats.abyss, icon: Swords },
    { label: 'Imaginarium Theater', amount: profile.stats.theaterAct == null ? null : `Act ${profile.stats.theaterAct}`, icon: Sparkles },
    { label: 'Stygian Onslaught', amount: profile.stats.stygian, icon: Flame },
  ];
  return <>
    <div id={`${id}-overview`} className="profile-section-anchor" tabIndex={-1}><ConnectedProfileBanner role={profile.role} csrf={csrf} onExpired={onExpired} /></div>
    <p className="muted connected-profile-updated"><Clock size={14} aria-hidden="true" /><span>Updated <time dateTime={new Date(profile.updatedAt).toISOString()}>{new Date(profile.updatedAt).toLocaleString()}</time> · Refresh for the latest reading.</span></p>
    {profile.unavailable.length > 0 && <p role="status" className="muted profile-availability-note">Some details are unavailable. {profile.unavailable.includes('notes') ? 'Enable Real-Time Notes in HoYoLAB for daily tasks. ' : ''}Available information is shown below.</p>}
    <nav className="profile-section-shortcuts" aria-label="My Profile sections">{jumps.map(({ key, label, icon: Icon }) => <button type="button" key={key} onClick={() => jump(key)}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}</nav>
    <section className="profile-metrics profile-metrics--overview profile-account-metrics" aria-label="My account progress">{metrics.map(({ label, amount, icon: Icon }) => <article key={label}><Icon size={19} aria-hidden="true" /><span>{label}</span><strong>{typeof amount === 'number' ? value(amount) : amount ?? '—'}</strong></article>)}</section>
    <section id={`${id}-daily`} tabIndex={-1} className="section-block profile-section-anchor"><SectionTitle eyebrow="REAL-TIME NOTES" title="Your daily adventure" /><div className="connected-profile-daily">
      <article className="panel profile-resin-card"><div className="eyebrow"><Droplets size={16} aria-hidden="true" />ORIGINAL RESIN</div><h2>{value(notes?.resin)} / {value(notes?.maxResin)}</h2>{notes?.resin != null && notes.maxResin != null && notes.maxResin > 0 && <progress className="profile-capacity" max={notes.maxResin} value={notes.resin} aria-label="Original Resin capacity" />}<p>{notes?.resin != null ? `Full recovery: ${duration(notes.recoverySeconds)}` : 'Enable Real-Time Notes in HoYoLAB to view resin.'}</p></article>
      <article className="panel"><div className="eyebrow"><CalendarDays size={16} aria-hidden="true" />DAILY COMMISSIONS</div><h2>{value(notes?.commissions)} / {value(notes?.maxCommissions)}</h2><p>{notes?.commissionRewardClaimed == null ? 'Reward status unavailable' : notes.commissionRewardClaimed ? 'Daily reward claimed' : 'Daily reward not claimed'}</p></article>
      <article className="panel"><div className="eyebrow"><Gem size={16} aria-hidden="true" />REALM CURRENCY</div><h2>{value(notes?.realmCurrency)} / {value(notes?.maxRealmCurrency)}</h2><p>Serenitea Pot currency at the last refresh.</p></article>
    </div>{Boolean(notes?.expeditions.length) && <div className="connected-profile-expeditions">{notes?.expeditions.map((entry, index) => <article className="panel" key={index}><ProfileImage src={entry.icon} alt="" className="talent-icon" fallback={<AssetPlaceholder kind="character" />} /><div><strong>Expedition {index + 1}</strong><span>{entry.status === 'Finished' ? 'Ready to collect' : duration(entry.remainingSeconds)}</span></div></article>)}</div>}</section>
    <section id={`${id}-characters`} tabIndex={-1} className="section-block profile-section-anchor"><SectionTitle eyebrow="MY CHARACTERS" title="Owned characters" description="Choose a character to inspect their equipped build." /><div className="profile-roster-controls">
      <label className="profile-roster-search"><Search size={17} aria-hidden="true" /><input className="search-input" type="search" aria-label="Search owned characters" placeholder="Search your characters" value={search} onChange={(event) => onRosterViewChange({ ...rosterView, search: event.target.value })} /></label>
      <label>Element<select aria-label="Filter owned characters by element" value={element} onChange={(event) => onRosterViewChange({ ...rosterView, element: event.target.value })}><option value="">All elements</option>{elements.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
      <label>Sort by<select aria-label="Sort owned characters" value={sort} onChange={(event) => onRosterViewChange({ ...rosterView, sort: event.target.value as ProfileRosterView['sort'] })}><option value="default">Roster order</option><option value="name">Name</option><option value="level">Highest level</option><option value="rarity">Rarity</option></select></label>
    </div><div className="profile-roster-results"><p className="muted" role="status">Showing {characters.length} of {roster.length} characters</p>{(search || element || sort !== 'default') && <button type="button" className="text-button" onClick={() => onRosterViewChange({ search: '', element: '', sort: 'default' })}>Clear filters</button>}</div><div className="showcase-grid connected-profile-roster">{characters.map((entry) => <OwnedCharacterCard key={entry.id} entry={entry} uid={profile.role.uid} />)}</div>{!characters.length && <p className="empty-state">{roster.length ? 'No characters match your filters.' : 'Owned character details are unavailable from HoYoLAB.'}</p>}</section>
    <section id={`${id}-exploration`} tabIndex={-1} className="section-block profile-section-anchor"><SectionTitle eyebrow="EXPLORATION" title="Your journey through Teyvat" /><div className="connected-profile-exploration">{profile.exploration.map((entry, index) => <ExplorationCard entry={entry} key={index} />)}</div>{!profile.exploration.length && <p className="muted">Exploration details were not shared by HoYoLAB.</p>}<div className="profile-metrics profile-metrics--overview profile-chest-metrics">{[...profile.stats.chests, { label: 'Waypoints', value: profile.stats.waypoints }, { label: 'Domains', value: profile.stats.domains }].map((entry) => <article key={entry.label}><span>{entry.label}</span><strong>{value(entry.value)}</strong></article>)}</div></section>
  </>;
}
