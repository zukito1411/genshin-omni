import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { AsyncImage } from '../components/AsyncImage';
import { AssetPlaceholder } from '../components/AssetPlaceholder';
import { SectionTitle } from '../components/SectionTitle';
import { usePaimonContext } from '../components/PaimonCompanion';
import { useEnkaProfile } from '../hooks/useEnkaProfile';
import type { EnkaEquipment, EnkaMetadata } from '../types/enka';
import { equipmentName, resolveEquipment } from '../utils/enkaEquipment';
import { ARTIFACT_SLOTS, avatarArtwork, avatarElement, avatarKey, avatarLevel, avatarMetadata, avatarName, COMBAT_STATS, combatValue, enkaImage, enkaText, equipmentStat } from '../utils/enka';

function EquipmentCard({ item, metadata, title }: { item: EnkaEquipment; metadata: EnkaMetadata | null; title: string }) {
  const flat = item.flat;
  const weapon = item.weapon;
  const refinements = Object.values(weapon?.affixMap ?? {});
  const refinement = refinements.length ? Math.max(0, ...refinements) + 1 : undefined;
  const stats = weapon
    ? (flat?.weaponStats ?? []).map((stat) => ({ stat, main: false }))
    : [
      ...(flat?.reliquaryMainstat ? [{ stat: flat.reliquaryMainstat, main: true }] : []),
      ...(flat?.reliquarySubstats ?? []).map((stat) => ({ stat, main: false })),
    ];
  return <article className={`panel equipped-item rarity-${flat?.rankLevel ?? 0}`}>
    <div className="equipped-item__head"><AsyncImage src={enkaImage(flat?.icon)} alt="" className="equipped-item__image" assetKey={`${weapon ? 'weapons' : 'artifacts'}:${item.itemId ?? flat?.icon}`} fallback={<AssetPlaceholder kind={weapon ? 'weapon' : 'artifact'} />} /><div><div className="eyebrow">{title}</div><h3>{equipmentName(item, metadata)}</h3><p>{flat?.rankLevel ? `${flat.rankLevel}★ · ` : ''}{weapon ? `Level ${weapon.level ?? '—'} · R${refinement ?? '—'}` : `+${item.reliquary?.level !== undefined ? Math.max(0, item.reliquary.level - 1) : '—'}`}</p></div></div>
    {!weapon && <p className="equipped-item__set">{enkaText(flat?.setNameTextMapHash, metadata, 'Artifact set unavailable')}</p>}
    <dl className="build-stat-list">{stats.map(({ stat, main }, index) => {
      const value = equipmentStat(stat);
      return <div className={main ? 'artifact-main-stat' : ''} key={`${value.label}-${index}`}><dt>{value.label}{main ? ' (main)' : ''}</dt><dd>{value.value}</dd></div>;
    })}</dl>
    {stats.length === 0 && <p>Equipment stats were not shared.</p>}
  </article>;
}

export function ShowcaseCharacterPage() {
  const { uid, avatar: selectedAvatar } = useParams();
  const { profile, metadata, metadataError, metadataLoading, loading, error, retry } = useEnkaProfile(uid);
  const { setContext } = usePaimonContext();
  const avatar = profile?.avatarInfoList?.find((entry) => avatarKey(entry) === selectedAvatar);
  const name = avatar ? avatarName(avatar, metadata) : 'Showcase character';
  const info = avatar ? avatarMetadata(avatar, metadata) : undefined;
  useEffect(() => { setContext({ page: 'profile', name }); }, [name, setContext]);
  useEffect(() => { window.scrollTo(0, 0); }, [uid, selectedAvatar]);

  const equipment = avatar?.equipList?.map((item) => resolveEquipment(item, metadata)) ?? [];
  const weapon = equipment.find((item) => item.weapon || item.flat?.itemType === 'ITEM_WEAPON');
  const artifacts = equipment.filter((item) => item.reliquary || item.flat?.itemType === 'ITEM_RELIQUARY');
  const setCounts = artifacts.reduce<Record<string, number>>((counts, item) => {
    const hash = item.flat?.setNameTextMapHash;
    if (hash !== undefined) counts[String(hash)] = (counts[String(hash)] ?? 0) + 1;
    return counts;
  }, {});
  const skills = info?.SkillOrder ?? Object.keys(avatar?.skillLevelMap ?? {}).map(Number);
  const constellationCount = avatar?.talentIdList?.length ?? 0;

  return <div>
    <Link className="button secondary" to={`/profile/${uid}`}><ArrowLeft size={15} />Back to profile</Link>
    {loading && <div className="loading" role="status">Loading equipped build…</div>}
    {error && <div className="error-box" role="alert"><p>{error}</p><button type="button" className="button secondary" onClick={retry}>Try again</button></div>}
    {!loading && profile && !avatar && <div className="empty-state">This character is no longer in the public showcase. Return to the profile to choose a shared character.</div>}
    {avatar && <>
      <section className={`panel showcase-build-hero showcase-build-hero--illustrated element-${avatarElement(avatar, metadata)?.toLowerCase() ?? 'unknown'}`}><AsyncImage src={avatarArtwork(avatar, metadata)} alt={name} className="showcase-build-hero__image" loading="eager" assetKey={`characters:${avatarKey(avatar)}:artwork`} fallback={<AssetPlaceholder kind="character" />} /><div className="showcase-build-hero__copy"><div className="eyebrow">{profile?.playerInfo.nickname || 'Traveler'} · UID {uid}</div><span className="pill showcase-element-badge">{avatarElement(avatar, metadata) ?? 'Character build'}</span><h1>{name}</h1><p>Level {avatarLevel(avatar)} · Ascension {avatar.propMap?.['1002']?.val ?? '—'} · Friendship {avatar.fetterInfo?.expLevel ?? '—'} · C{constellationCount}</p><p className="muted">Equipped build from the latest public showcase snapshot.</p></div><a className="button secondary" target="_blank" rel="noreferrer" href={`https://enka.network/u/${uid}/`}>View on Enka <ExternalLink size={14} /></a></section>
      {metadataLoading && <p className="muted">Loading names and equipment stat definitions…</p>}
      {metadataError && <p className="muted">Game definitions could not load. Names and stats omitted by the showcase cannot be resolved until they load. <button className="text-button" onClick={retry}>Retry</button></p>}
      {info?.NameTextMapHash && metadata?.text[String(info.NameTextMapHash)] && <p><Link className="button secondary" to={`/characters/${encodeURIComponent(name)}`}>Character guide, skills, and build recommendations</Link></p>}
      <section className="section-block"><SectionTitle eyebrow="COMBAT STATS" title="Character attributes" description="These are the character’s shared equipped stats, including their weapon and artifacts." /><dl className="showcase-stats">{COMBAT_STATS.slice(0, 7).map(([id, label, percent]) => <div key={id}><dt>{label}</dt><dd>{combatValue(avatar.fightPropMap?.[id], percent)}</dd></div>)}{COMBAT_STATS.filter(([id]) => ['30', '40', '41', '42', '43', '44', '45', '46'].includes(id) && (avatar.fightPropMap?.[id] ?? 0) !== 0).map(([id, label, percent]) => <div key={id}><dt>{label}</dt><dd>{combatValue(avatar.fightPropMap?.[id], percent)}</dd></div>)}</dl><details className="showcase-additional-stats"><summary>Damage bonuses, resistances, and other attributes</summary><dl className="showcase-stats">{COMBAT_STATS.slice(7).map(([id, label, percent]) => <div key={id}><dt>{label}</dt><dd>{combatValue(avatar.fightPropMap?.[id], percent)}</dd></div>)}</dl></details></section>
      <section className="section-block"><SectionTitle eyebrow="EQUIPMENT" title="Weapon" />{weapon ? <EquipmentCard item={weapon} metadata={metadata} title="Equipped weapon" /> : <div className="empty-state">No equipped weapon was shared.</div>}</section>
      <section className="section-block"><SectionTitle eyebrow="EQUIPMENT" title="Artifacts" description="Each piece includes its main stat and all shared substats." />
        {Object.keys(setCounts).length > 0 && <div className="artifact-set-summary">{Object.entries(setCounts).map(([hash, count]) => <span className="pill" key={hash}>{enkaText(hash, metadata, 'Set name unavailable')} · {count} pieces</span>)}</div>}
        <div className="equipped-artifact-grid">{Object.entries(ARTIFACT_SLOTS).map(([slot, label]) => {
          const item = artifacts.find((entry) => entry.flat?.equipType === slot);
          return item ? <EquipmentCard key={slot} item={item} metadata={metadata} title={label} /> : <article className="panel equipped-item" key={slot}><h3>{label}</h3><p>No piece shared for this slot.</p></article>;
        })}{artifacts.filter((item) => !Object.keys(ARTIFACT_SLOTS).includes(item.flat?.equipType ?? '')).map((item, index) => <EquipmentCard key={`extra-${index}`} item={item} metadata={metadata} title="Artifact" />)}</div>
      </section>
      <section className="section-block"><SectionTitle eyebrow="PROGRESSION" title="Talents" description="Shown levels include constellation bonuses when those are supplied by the showcase." /><div className="showcase-talents">{skills.map((skill, index) => {
        const base = avatar.skillLevelMap?.[String(skill)];
        const proudId = info?.ProudMap?.[String(skill)];
        const bonus = proudId === undefined ? 0 : avatar.proudSkillExtraLevelMap?.[String(proudId)] ?? 0;
        return <article className="panel" key={skill}><AsyncImage src={enkaImage(info?.Skills?.[String(skill)])} alt="" className="talent-icon" assetKey={`talents:${avatarKey(avatar)}:${skill}`} fallback={<AssetPlaceholder kind="talent" />} /><h3>{info?.SkillOrder ? ['Normal Attack', 'Elemental Skill', 'Elemental Burst'][index] ?? 'Shared talent' : 'Shared talent'}</h3><strong>Level {base === undefined ? '—' : base + bonus}</strong>{bonus > 0 && <small>Base {base} + {bonus} constellation bonus</small>}</article>;
      })}</div>{skills.length === 0 && <div className="empty-state">No talent levels were shared.</div>}</section>
      <section className="section-block"><SectionTitle eyebrow="PROGRESSION" title={`Constellations · C${constellationCount}`} /><div className="showcase-constellations">{Array.from({ length: 6 }, (_, index) => <article className={`panel ${index < constellationCount ? 'unlocked' : ''}`} key={index}><AsyncImage src={enkaImage(info?.Consts?.[index])} alt="" className="talent-icon" assetKey={`constellations:${avatarKey(avatar)}:${index}`} fallback={<AssetPlaceholder kind="talent" />} /><strong>C{index + 1}</strong><span>{index < constellationCount ? 'Unlocked' : 'Locked'}</span></article>)}</div></section>
      <details className="panel showcase-raw"><summary>All shared build data</summary><pre>{JSON.stringify(avatar, null, 2)}</pre></details>
    </>}
  </div>;
}
