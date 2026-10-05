import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Search, ShieldCheck } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { AsyncImage } from '../components/AsyncImage';
import { AssetPlaceholder } from '../components/AssetPlaceholder';
import { ProfileOverview } from '../components/ProfileOverview';
import { useCharacters } from '../hooks/useCharacters';
import { useEnkaProfile } from '../hooks/useEnkaProfile';
import { avatarElement, avatarId, avatarImage, avatarKey, avatarLevel, avatarName, PROFILE_UID_KEY, savedUid } from '../utils/enka';
import { readOwnedCharacterIds, writeOwnedCharacterIds } from '../utils/playerData';

export function ProfilePage() {
  const { uid: selectedUid } = useParams();
  const navigate = useNavigate();
  const [uid, setUid] = useState(() => selectedUid ?? savedUid());
  const [inputError, setInputError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const { profile, loading, error, metadata, metadataError, retry } = useEnkaProfile(selectedUid);
  const { allCharacters } = useCharacters('');
  const player = profile?.playerInfo;
  const avatars = profile?.avatarInfoList ?? [];
  const matched = useMemo(() => avatars.flatMap((avatar) => {
    const resolvedName = avatarName(avatar, metadata).toLowerCase();
    const character = allCharacters.find((entry) => String(entry.gameId) === avatarId(avatar) ||
      entry.name.toLowerCase() === resolvedName ||
      (['10000005', '10000007'].includes(avatarId(avatar)) && entry.id === 'traveler'));
    return character ? [character.id] : [];
  }), [profile, metadata, allCharacters]);

  useEffect(() => { if (selectedUid) setUid(selectedUid); setImportMessage(''); }, [selectedUid]);
  useEffect(() => {
    if (profile && selectedUid) {
      try { localStorage.setItem(PROFILE_UID_KEY, selectedUid); } catch { /* Optional storage. */ }
    }
  }, [profile, selectedUid]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = uid.trim();
    if (!/^\d{9,10}$/.test(clean)) { setInputError('Enter a UID containing 9 or 10 digits.'); return; }
    setInputError('');
    if (selectedUid === clean) retry();
    else navigate(`/profile/${clean}`);
  }

  function importRoster() {
    writeOwnedCharacterIds([...new Set([...readOwnedCharacterIds(), ...matched])]);
    setImportMessage(`${new Set(matched).size} showcase characters added to My Roster.`);
  }

  return <div>
    <SectionTitle eyebrow="PLAYER PROFILE" title="UID Search" description="Look up a public Genshin profile, then select a showcase character to inspect their equipped build." action={<Link className="button secondary" to="/account">My Roster</Link>} />
    <form className="lookup-form uid-search uid-search--panel" onSubmit={submit}>
      <label htmlFor="profile-uid">Genshin UID</label>
      <div><input id="profile-uid" value={uid} onChange={(event) => { setUid(event.target.value); setInputError(''); }} inputMode="numeric" autoComplete="off" maxLength={10} placeholder="9 or 10-digit UID" aria-invalid={Boolean(inputError)} aria-describedby="uid-help" required /><button className="button primary" disabled={loading}><Search size={16} />{loading ? 'Loading…' : 'Search UID'}</button></div>
    </form>
    <p className="muted" id="uid-help">Only public showcase characters can be loaded. Enable “Show Character Details” in your in-game profile. Public lookups may use the Jina reader if Enka is unavailable.</p>
    {(inputError || error) && <div className="error-box" role="alert"><strong>Lookup failed.</strong><p>{inputError || error}</p>{error && <button type="button" className="button secondary" onClick={retry}>Try again</button>}</div>}
    {loading && <div className="loading" role="status">Loading public profile…</div>}
    {!selectedUid && <div className="uid-welcome panel"><div className="uid-welcome__emblem"><ShieldCheck size={38} /></div><h3>Your adventure, at a glance</h3><p>See a player’s public profile, achievements, namecards, and equipped showcase builds.</p><span>No game password needed. Only public information is shown.</span></div>}
    {profile && player && <>
      <ProfileOverview profile={profile} metadata={metadata} uid={selectedUid ?? ''} />
      <section className="section-block"><SectionTitle eyebrow="CHARACTER SHOWCASE" title="Equipped builds" description="Select a character to see combat stats, talent levels, constellations, weapon, and every shared artifact." action={matched.length > 0 && <button type="button" className="button secondary" onClick={importRoster}>Add showcase to My Roster</button>} />
        {importMessage && <p role="status" className="muted">{importMessage}</p>}
        {metadataError && <p className="muted">Names and images could not load. Build stats remain available. <button className="text-button" type="button" onClick={retry}>Retry</button></p>}
        {avatars.length ? <div className="showcase-grid">{avatars.map((avatar) => <Link className="showcase-card showcase-card--link" key={avatarKey(avatar)} to={`/profile/${selectedUid}/characters/${avatarKey(avatar)}`}>
          <AsyncImage src={avatarImage(avatar, metadata)} alt="" className="showcase-card__image" assetKey={`characters:${avatarKey(avatar)}:icon`} fallback={<AssetPlaceholder kind="character" />} />
          <div><strong>{avatarName(avatar, metadata)}</strong><span className={`showcase-element element-${avatarElement(avatar, metadata)?.toLowerCase() ?? 'unknown'}`}>{avatarElement(avatar, metadata) ?? 'Showcase'}</span><span>Level {avatarLevel(avatar)} · C{avatar.talentIdList?.length ?? 0}</span><span>View equipped build</span></div><ArrowRight size={17} />
        </Link>)}</div> : <div className="empty-state">This player has no public character build details. Enable “Show Character Details” in-game, then try again.</div>}
      </section>
    </>}
  </div>;
}
