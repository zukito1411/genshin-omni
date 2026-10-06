import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Droplets, ExternalLink, LogOut, RefreshCw, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { AssetPlaceholder } from '../components/AssetPlaceholder';
import { HoYoLabLoginForm } from '../components/HoYoLabLoginForm';
import { usePaimonContext } from '../components/PaimonCompanion';
import { useCharacters } from '../hooks/useCharacters';
import { characterImageSources } from '../api/genshinDev';
import { MyProfileError, myProfileRequest } from '../api/myProfile';
import type { PrivateBuild, PrivateEquipment, PrivateProfile, PrivateStat, ProfileSession } from '../types/myProfile';

const value = (number: number | null | undefined) => number === null || number === undefined ? '—' : number.toLocaleString();
function duration(seconds: number | null) {
  if (seconds === null) return 'Time unavailable';
  if (seconds === 0) return 'Ready';
  const minutes = Math.ceil(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}
function Stats({ stats }: { stats: PrivateStat[] }) {
  return stats.length ? <dl className="showcase-stats">{stats.map((stat, index) => <div key={`${stat.label}-${index}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl> : <p className="muted">These stats were not shared by HoYoLAB.</p>;
}
function Equipment({ item, title }: { item: PrivateEquipment; title: string }) {
  return <article className="panel equipped-item"><div className="equipped-item__head"><AsyncImage src={item.icon} alt="" className="equipped-item__image" fallback={<AssetPlaceholder kind="artifact" />} /><div><div className="eyebrow">{title}</div><h3>{item.name}</h3><p>Level {value(item.level)}</p></div></div><Stats stats={item.stats} /></article>;
}
const OwnedCharacterCard = memo(function OwnedCharacterCard({ entry, uid }: { entry: PrivateProfile['characters'][number]; uid: string }) {
  return <Link className="showcase-card showcase-card--link" to={`/me/${uid}/characters/${entry.id}`}><AsyncImage src={entry.icon} alt="" className="showcase-card__image" fallback={<AssetPlaceholder kind="character" />} /><div><strong>{entry.name}</strong><span>{entry.element} · Level {value(entry.level)} · C{value(entry.constellation)}</span><span>View equipped build</span></div><ArrowRight size={17} /></Link>;
});
function ConnectedBuild({ build }: { build: PrivateBuild }) {
  return <>
    <section className="panel showcase-build-hero"><AsyncImage src={build.image || build.icon} alt="" className="showcase-build-hero__image" loading="eager" fallback={<AssetPlaceholder kind="character" />} /><div className="showcase-build-hero__copy"><div className="eyebrow">MY EQUIPPED BUILD</div><h1>{build.name}</h1><p>{build.element} · Level {value(build.level)} · C{value(build.constellation)} · Friendship {value(build.friendship)}</p></div></section>
    <section className="section-block"><SectionTitle eyebrow="COMBAT STATS" title="Character attributes" /><Stats stats={build.stats} /></section>
    <section className="section-block"><SectionTitle eyebrow="EQUIPMENT" title="Weapon" />{build.weapon ? <><Equipment item={build.weapon} title={`Refinement ${value(build.weapon.refinement)}`} /></> : <p>No equipped weapon was shared.</p>}</section>
    <section className="section-block"><SectionTitle eyebrow="EQUIPMENT" title="Artifacts" /><div className="equipped-artifact-grid">{build.artifacts.map((artifact, index) => <div key={index}><Equipment item={artifact} title={artifact.slot || 'Artifact'} />{artifact.set && <p className="muted">{artifact.set}</p>}</div>)}</div>{!build.artifacts.length && <p>No equipped artifacts were shared.</p>}</section>
    <section className="section-block"><SectionTitle eyebrow="TALENTS" title="Skills & abilities" /><div className="talent-detail-grid">{build.skills.map((skill, index) => <article className="talent-detail" key={index}><AsyncImage src={skill.icon} className="ability-icon" alt="" fallback={<AssetPlaceholder kind="talent" />} /><div><h3>{skill.name}</h3><strong>Level {value(skill.level)}</strong><p>{skill.description || 'Description unavailable.'}</p></div></article>)}</div>{!build.skills.length && <p>No talent details were shared.</p>}</section>
    <section className="section-block"><SectionTitle eyebrow="PROGRESSION" title="Constellations" /><div className="constellation-list">{build.constellations.map((entry, index) => <article className="constellation-row" key={index}><div className="constellation-marker"><AsyncImage src={entry.icon} className="ability-icon" alt="" fallback={<AssetPlaceholder kind="talent" />} /><span>C{index + 1}</span></div><div><h3>{entry.name}</h3><strong>{entry.unlocked ? 'Unlocked' : 'Locked'}</strong><p>{entry.description || 'Description unavailable.'}</p></div></article>)}</div>{!build.constellations.length && <p>No constellation details were shared.</p>}</section>
  </>;
}
function AdvancedConnectionForm({ busy, onConnect }: { busy: boolean; onConnect: (input: object) => Promise<void> }) {
  const [accountId, setAccountId] = useState('');
  const [token, setToken] = useState('');
  const [version, setVersion] = useState('v2');
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    const clear = () => { setAccountId(''); setToken(''); setConsent(false); };
    const hidden = () => { if (document.visibilityState === 'hidden') { setToken(''); setConsent(false); } };
    window.addEventListener('pagehide', clear); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = { action: 'connect', accountId: accountId.trim(), token: token.trim(), version, consent };
    setToken(''); setAccountId(''); setConsent(false);
    await onConnect(input);
  }
  return <div>
    <p>This optional method is for players who already have their HoYoLAB session details. Use the simpler sign-in form above otherwise. Never paste a password into the session token field.</p>
    <details className="connected-profile-help"><summary>What do I need to connect?</summary><p>Sign in on the official HoYoLAB website first. This connection uses the account ID and session token from that existing session. On a desktop browser, open HoYoLAB's site storage and find the matching <code>ltuid_v2</code> and <code>ltoken_v2</code> values. Older sessions use <code>ltuid</code> and <code>ltoken</code> instead. Your HoYoLAB account ID is different from your Genshin UID.</p><p>Session tokens are sensitive. Only connect your own account on a site you trust. If you cannot obtain your session on mobile, UID Search remains available without connecting.</p><a href="https://www.hoyolab.com/" target="_blank" rel="noreferrer" className="source-button">Open official HoYoLAB <ExternalLink size={14} /></a></details>
    <form onSubmit={(event) => void submit(event)} autoComplete="off" className="connected-profile-form">
      <label>HoYoLAB account ID<input type="text" inputMode="numeric" pattern="[0-9]{1,20}" maxLength={20} value={accountId} onChange={(event) => setAccountId(event.target.value)} autoComplete="off" required disabled={busy} /></label>
      <label>HoYoLAB session token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} minLength={20} maxLength={2048} autoComplete="off" spellCheck={false} autoCapitalize="none" required disabled={busy} /></label>
      <label>Session version<select value={version} onChange={(event) => setVersion(event.target.value)} disabled={busy}><option value="v2">Current session (v2)</option><option value="v1">Older session (v1)</option></select></label>
      <label className="connected-profile-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required disabled={busy} /><span>This is my account. I agree to this site securely storing my session to read my account information.</span></label>
      <button type="submit" className="button primary" disabled={busy || !consent}>{busy ? 'Connecting…' : 'Connect account'}</button>
    </form><p className="muted">Supports global Genshin servers. No daily rewards are claimed and no HoYoLAB privacy settings are changed.</p>
  </div>;
}

function AccountConnection({ busy, directLogin, onConnect, onConnected }: { busy: boolean; directLogin: boolean; onConnect: (input: object) => Promise<void>; onConnected: (session: ProfileSession) => void }) {
  const [loginBusy, setLoginBusy] = useState(false);
  return <section className="panel connected-profile-connect">
    <div className="connected-profile-intro"><ShieldCheck size={32} /><div><h3>Connect your own HoYoLAB account</h3><p>See your characters, equipment, progress, and daily notes in one place.</p></div></div>
    {directLogin ? <HoYoLabLoginForm onConnected={onConnected} disabled={busy} onBusyChange={setLoginBusy} /> : <p>Direct sign-in is temporarily unavailable on this site. UID Search still works without signing in.</p>}
    <p className="muted">Your connected session is encrypted on the server, expires here after 24 hours, and is removed when you disconnect.</p>
    <details className="connected-profile-help"><summary>Advanced session connection (optional)</summary><AdvancedConnectionForm busy={busy || loginBusy} onConnect={onConnect} /></details>
  </section>;
}

export function MyProfilePage() {
  const { uid, characterId } = useParams();
  const navigate = useNavigate();
  const { setContext } = usePaimonContext();
  const [session, setSession] = useState<ProfileSession | null>(null);
  const [profile, setProfile] = useState<PrivateProfile | null>(null);
  const [build, setBuild] = useState<PrivateBuild | null>(null);
  const [error, setError] = useState('');
  const [buildError, setBuildError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const { allCharacters } = useCharacters('', Boolean(profile?.characters.some((entry) => entry.name === 'Name unavailable' || !entry.icon || !entry.element)));
  const catalog = useMemo(() => new Map(allCharacters.map((entry) => [String(entry.gameId ?? entry.id), entry])), [allCharacters]);
  const enrich = (entry: PrivateProfile['characters'][number]) => {
    const match = catalog.get(String(entry.id));
    return { ...entry, name: entry.name === 'Name unavailable' ? match?.name ?? entry.name : entry.name, element: entry.element || match?.element || '', icon: entry.icon || (match ? characterImageSources(match, 'icon')[0] : '') };
  };
  const enrichedCharacters = useMemo(() => profile?.characters.map((entry) => {
    const match = catalog.get(String(entry.id));
    return { ...entry, name: entry.name === 'Name unavailable' ? match?.name ?? entry.name : entry.name, element: entry.element || match?.element || '', icon: entry.icon || (match ? characterImageSources(match, 'icon')[0] : '') };
  }) ?? [], [profile, catalog]);
  const operation = useRef<AbortController | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const role = session?.roles?.find((entry) => entry.uid === uid) ?? (!uid ? session?.roles?.[0] : undefined);
  useEffect(() => { setContext({ page: 'account' }); }, [setContext]); // Never share private account names with AI Paimon.
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void myProfileRequest<ProfileSession>('GET', undefined, undefined, controller.signal).then((result) => { if (!controller.signal.aborted) setSession(result); }).catch((reason) => {
      if (!controller.signal.aborted) { setSession({ available: reason instanceof MyProfileError && reason.code === 'reconnect', connected: false }); setError(reason instanceof Error ? reason.message : 'Connection unavailable.'); }
    });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setProfile(null); setBuild(null); setBuildError(''); setSearch('');
    if (busy || !session?.connected || !role || !session.csrf) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    void myProfileRequest<{ profile: PrivateProfile }>('POST', { action: 'profile', uid: role.uid }, session.csrf, controller.signal).then((result) => {
      if (!controller.signal.aborted) setProfile(result.profile);
    }).catch((reason) => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : 'Profile unavailable.');
      if (reason instanceof MyProfileError && reason.code === 'reconnect') setSession({ available: true, connected: false });
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session?.connected, session?.csrf, role?.uid, refresh, busy]);
  useEffect(() => {
    const controller = new AbortController();
    setBuild(null); setBuildError('');
    if (busy || !characterId || !profile || !session?.csrf) return () => controller.abort();
    if (!profile.characters.some((entry) => String(entry.id) === characterId)) { setBuildError('This character is not in your connected roster.'); return () => controller.abort(); }
    void myProfileRequest<{ character: PrivateBuild }>('POST', { action: 'character', uid: profile.role.uid, characterId: Number(characterId) }, session.csrf, controller.signal).then((result) => { if (!controller.signal.aborted) setBuild(result.character); }).catch((reason) => {
      if (!controller.signal.aborted) { setBuildError(reason instanceof Error ? reason.message : 'Build unavailable.'); if (reason instanceof MyProfileError && reason.code === 'reconnect') setSession({ available: true, connected: false }); }
    });
    return () => controller.abort();
  }, [characterId, profile, session?.csrf, busy]);
  useEffect(() => {
    const recheck = () => { operation.current?.abort(); setBusy(false); setProfile(null); setBuild(null); setSession(null); setRefresh((previous) => previous + 1); };
    const show = () => { if (document.visibilityState === 'visible') recheck(); };
    const hide = () => { operation.current?.abort(); setProfile(null); setBuild(null); setSession(null); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) recheck(); };
    try { channel.current = new BroadcastChannel('teyvat-profile-connection'); channel.current.onmessage = recheck; } catch { /* Visibility rechecks remain available. */ }
    document.addEventListener('visibilitychange', show); window.addEventListener('pagehide', hide); window.addEventListener('pageshow', restore);
    return () => { operation.current?.abort(); channel.current?.close(); channel.current = null; document.removeEventListener('visibilitychange', show); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', restore); };
  }, []);
  async function connect(input: object) {
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError('');
    try { const result = await myProfileRequest<ProfileSession>('POST', input, undefined, controller.signal); if (!controller.signal.aborted) { setSession(result); navigate('/me', { replace: true }); channel.current?.postMessage('changed'); } }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Connection unavailable.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function acceptConnection(result: ProfileSession) {
    setError(''); setSession(result); navigate('/me', { replace: true }); channel.current?.postMessage('changed');
  }
  async function disconnect() {
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError(''); setProfile(null); setBuild(null);
    try { await myProfileRequest('DELETE', undefined, session?.csrf, controller.signal); if (!controller.signal.aborted) { setSession({ available: true, connected: false }); navigate('/me', { replace: true }); channel.current?.postMessage('changed'); } }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Disconnect failed. Please try again.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const characters = useMemo(() => enrichedCharacters.filter((entry) => entry.name.toLowerCase().includes(deferredSearch.toLowerCase())), [enrichedCharacters, deferredSearch]);
  const notes = profile?.notes;
  return <div className="connected-profile-page">
    <SectionTitle eyebrow="MY ACCOUNT" title="My Profile" description="Your connected Genshin account, progress, and daily notes. Private account information stays out of public UID Search." action={<Link to="/profile" className="button secondary">UID Search</Link>} />
    {error && <div role="alert" className="error-box">{error}</div>}
    {!session ? <div className="loading" role="status">Checking your connection…</div> : !session.available ? <section className="panel connected-profile-connect"><div className="connected-profile-intro"><ShieldCheck size={32} /><div><h3>Account connection is not available yet</h3><p>This site is not ready to connect HoYoLAB accounts. No session information is requested or saved. Public UID Search and your saved plans still work.</p></div></div><button type="button" className="button secondary" onClick={() => setRefresh((previous) => previous + 1)}>Check again</button></section> : !session.connected ? <AccountConnection busy={busy} directLogin={session.directLogin !== false} onConnect={connect} onConnected={acceptConnection} /> : <>
      <section className="panel connected-profile-toolbar"><label>Your Genshin account<select value={role?.uid ?? ''} onChange={(event) => navigate(`/me/${event.target.value}`)} disabled={busy}><option value="" disabled>Select an account</option>{session.roles?.map((entry) => <option key={entry.uid} value={entry.uid}>{entry.nickname} · {entry.server} · {entry.uid}</option>)}</select></label><div><button type="button" className="button secondary" onClick={() => setRefresh((previous) => previous + 1)} disabled={busy || loading}><RefreshCw size={15} />Refresh</button><button type="button" className="button secondary" onClick={() => void disconnect()} disabled={busy}><LogOut size={15} />{busy ? 'Disconnecting…' : 'Disconnect'}</button></div></section>
      {!role && <div className="empty-state">This UID is not connected to your HoYoLAB account. Choose one of your accounts above.</div>}
      {loading && <div className="detail-loading" role="status" aria-label="Loading your profile"><div className="skeleton-hero" /><div className="skeleton-line" /></div>}
      {profile && !characterId && <>
        <section className="profile-banner panel connected-profile-banner"><div className="profile-banner__content"><div className="profile-avatar-frame"><UserRound size={42} /></div><div className="profile-banner__copy"><div className="eyebrow">MY CONNECTED PROFILE</div><h2>{profile.role.nickname}</h2><p>{profile.role.server} · UID {profile.role.uid} · Adventure Rank {value(profile.role.level)}</p><span className="pill"><ShieldCheck size={13} />Private connection</span></div></div></section>
        <p className="muted connected-profile-updated"><Clock size={14} />Last updated {new Date(profile.updatedAt).toLocaleString()}. Values reflect that reading, not a live game connection.</p>
        {profile.unavailable.length > 0 && <p role="status" className="muted">Some details are unavailable. Enable Real-Time Notes in HoYoLAB for daily tasks, and try refreshing later. Available information is shown below.</p>}
        <section className="profile-metrics profile-metrics--overview" aria-label="My account progress">{[['Achievements', profile.stats.achievements], ['Days active', profile.stats.daysActive], ['Characters', profile.stats.characters], ['Spiral Abyss', profile.stats.abyss], ['Imaginarium Theater', profile.stats.theaterAct === null || profile.stats.theaterAct === undefined ? null : `Act ${profile.stats.theaterAct}`], ['Stygian Onslaught', profile.stats.stygian]].map(([label, amount]) => <article key={String(label)}><Trophy size={20} /><span>{label}</span><strong>{typeof amount === 'number' ? value(amount) : amount ?? '—'}</strong></article>)}</section>
        <section className="section-block"><SectionTitle eyebrow="REAL-TIME NOTES" title="Your daily adventure" /><div className="connected-profile-daily">
          <article className="panel"><div className="eyebrow"><Droplets size={16} />ORIGINAL RESIN</div><h2>{value(notes?.resin)} / {value(notes?.maxResin)}</h2><p>{notes?.resin !== null && notes?.resin !== undefined ? `Full recovery: ${duration(notes.recoverySeconds)}` : 'Enable Real-Time Notes in HoYoLAB to view resin.'}</p></article>
          <article className="panel"><div className="eyebrow">DAILY COMMISSIONS</div><h2>{value(notes?.commissions)} / {value(notes?.maxCommissions)}</h2><p>{notes?.commissionRewardClaimed === null || !notes ? 'Reward status unavailable' : notes.commissionRewardClaimed ? 'Daily reward claimed' : 'Daily reward not claimed'}</p></article>
          <article className="panel"><div className="eyebrow">REALM CURRENCY</div><h2>{value(notes?.realmCurrency)} / {value(notes?.maxRealmCurrency)}</h2><p>Your Serenitea Pot currency at the last refresh.</p></article>
        </div>{Boolean(notes?.expeditions.length) && <div className="connected-profile-expeditions">{notes?.expeditions.map((entry, index) => <article className="panel" key={index}><AsyncImage src={entry.icon} alt="" className="talent-icon" fallback={<AssetPlaceholder kind="character" />} /><strong>Expedition {index + 1}</strong><span>{entry.status === 'Finished' ? 'Ready to collect' : duration(entry.remainingSeconds)}</span></article>)}</div>}</section>
        <section className="section-block"><SectionTitle eyebrow="MY CHARACTERS" title="Owned characters" description="Open a character to view their equipped stats, weapons, artifacts, talents, and constellations when shared by HoYoLAB." /><input className="search-input" type="search" aria-label="Search owned characters" placeholder="Search your characters" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="showcase-grid connected-profile-roster">{characters.map((entry) => <OwnedCharacterCard key={entry.id} entry={entry} uid={profile.role.uid} />)}</div>{!characters.length && <p className="empty-state">{profile.characters.length ? 'No characters match your search.' : 'Owned character details are unavailable from HoYoLAB.'}</p>}</section>
        <section className="section-block"><SectionTitle eyebrow="EXPLORATION" title="Your journey through Teyvat" /><div className="connected-profile-exploration">{profile.exploration.map((entry, index) => <article className="panel" key={index}><AsyncImage src={entry.icon} alt="" className="talent-icon" fallback={<AssetPlaceholder kind="material" />} /><div><h3>{entry.name}</h3><strong>{entry.percentage === null ? '—' : `${entry.percentage}%`}</strong><p>Level {value(entry.level)}</p></div></article>)}</div><div className="profile-metrics profile-metrics--overview">{[...profile.stats.chests, { label: 'Waypoints', value: profile.stats.waypoints }, { label: 'Domains', value: profile.stats.domains }].map((entry) => <article key={entry.label}><span>{entry.label}</span><strong>{value(entry.value)}</strong></article>)}</div></section>
      </>}
      {characterId && <><Link to={`/me/${role?.uid ?? ''}`} className="button secondary"><ArrowLeft size={15} />Back to My Profile</Link>{buildError ? <div role="alert" className="error-box">{buildError}</div> : build ? <ConnectedBuild build={{ ...build, ...enrich(build) }} /> : profile && <div role="status" className="loading">Loading your equipped build…</div>}</>}
      <p className="muted connected-profile-privacy">Your account information is not saved in browser storage or sent to AI Paimon. Disconnect removes this connection from our server. Some HoYoLAB features may be unavailable; this page does not expose every part of your game account.</p>
    </>}
  </div>;
}
