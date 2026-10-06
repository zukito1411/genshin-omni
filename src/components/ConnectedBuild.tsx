import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { ProfileImage } from './ProfileImage';
import { AssetPlaceholder } from './AssetPlaceholder';
import { SectionTitle } from './SectionTitle';
import { connectedGameText } from '../../shared/connectedGameText.mjs';
import type { PrivateBuild, PrivateCharacter, PrivateEquipment, PrivateStat } from '../types/myProfile';

const value = (number: number | null | undefined) => number == null ? '—' : number.toLocaleString();
const tabs = ['Overview', 'Artifacts', 'Talents', 'Constellations'] as const;
type Tab = typeof tabs[number];

function Stats({ stats, compact = false }: { stats: PrivateStat[]; compact?: boolean }) {
  return stats.length ? <dl className={compact ? 'build-stat-list' : 'showcase-stats'}>{stats.map((stat, index) => <div key={`${stat.label}-${index}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl> : <p className="muted">These stats were not shared by HoYoLAB.</p>;
}

function Equipment({ item, title, kind, set }: { item: PrivateEquipment; title: string; kind: 'weapon' | 'artifact'; set?: string }) {
  return <article className="panel equipped-item">
    <div className="equipped-item__head"><ProfileImage src={item.icon} alt="" className="equipped-item__image" fallback={<AssetPlaceholder kind={kind} />} /><div><div className="eyebrow">{title}</div><h3>{item.name}</h3><p>Level {value(item.level)}</p></div></div>
    {set && <p className="muted equipped-item__set">{set}</p>}
    <Stats stats={item.stats} compact />
  </article>;
}

function Ability({ name, icon, status, description, marker }: { name: string; icon: string; status: string; description: string; marker?: string }) {
  return <details className="connected-build-ability panel">
    <summary><div className="connected-build-ability__icon"><ProfileImage src={icon} className="ability-icon" alt="" fallback={<AssetPlaceholder kind="talent" />} />{marker && <span>{marker}</span>}</div><div><h3>{name}</h3><span className="muted">{status}</span></div><ChevronDown size={18} aria-hidden="true" /></summary>
    <p>{connectedGameText(description) || 'Description unavailable.'}</p>
  </details>;
}

export function ConnectedBuild({ build, characters, onCharacterChange }: { build: PrivateBuild; characters: PrivateCharacter[]; onCharacterChange: (id: number) => void }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => { root.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, []);
  function selectTab(next: Tab) {
    // If the sticky navigation is being used from far down a description,
    // restore the panel start instead of leaving the reader near its bottom.
    const nav = root.current?.querySelector('.connected-build-tabs');
    const rect = nav?.getBoundingClientRect();
    if (rect && rect.top <= 74) nav?.scrollIntoView({ block: 'start', behavior: 'instant' });
    setTab(next);
  }
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); selectTab(tabs[next]); buttons.current[next]?.focus({ preventScroll: true }); buttons.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  return <div className="connected-build" ref={root}>
    <label className="connected-build-picker">Your characters<select aria-label="Choose owned character" value={build.id} onChange={(event) => onCharacterChange(Number(event.target.value))}>{characters.map((character) => <option key={character.id} value={character.id}>{character.name} · Level {value(character.level)}</option>)}</select></label>
    <section className="panel showcase-build-hero"><ProfileImage src={build.image || build.icon} alt="" className="showcase-build-hero__image" loading="eager" fallback={<AssetPlaceholder kind="character" />} /><div className="showcase-build-hero__copy"><div className="eyebrow">MY EQUIPPED BUILD</div><h1>{build.name}</h1><p>{build.element} · Level {value(build.level)} · C{value(build.constellation)} · Friendship {value(build.friendship)}</p></div></section>
    <div className="connected-build-tabs" role="tablist" aria-label="Equipped build sections">{tabs.map((entry, index) => <button key={entry} ref={(node) => { buttons.current[index] = node; }} type="button" role="tab" id={`${id}-tab-${entry}`} aria-controls={`${id}-panel-${entry}`} aria-selected={tab === entry} tabIndex={tab === entry ? 0 : -1} onClick={() => selectTab(entry)} onKeyDown={(event) => navigateTabs(event, index)}>{entry}</button>)}</div>
    {tabs.map((entry) => <div key={entry} className="connected-build-panel" role="tabpanel" id={`${id}-panel-${entry}`} aria-labelledby={`${id}-tab-${entry}`} tabIndex={0} hidden={tab !== entry}>{tab === entry && <>
      {tab === 'Overview' && <><section className="section-block"><SectionTitle eyebrow="COMBAT STATS" title="Character attributes" /><Stats stats={build.stats} /></section><section className="section-block"><SectionTitle eyebrow="EQUIPMENT" title="Weapon" />{build.weapon ? <Equipment item={build.weapon} title={`Refinement ${value(build.weapon.refinement)}`} kind="weapon" /> : <p>No equipped weapon was shared.</p>}</section></>}
      {tab === 'Artifacts' && <section className="section-block"><SectionTitle eyebrow="EQUIPMENT" title="Artifacts" /><div className="equipped-artifact-grid">{build.artifacts.map((artifact, index) => <Equipment key={index} item={artifact} title={artifact.slot || 'Artifact'} kind="artifact" set={artifact.set} />)}</div>{!build.artifacts.length && <p>No equipped artifacts were shared.</p>}</section>}
      {tab === 'Talents' && <section className="section-block"><SectionTitle eyebrow="TALENTS" title="Skills & abilities" description="Tap an ability to read its full description." /><div className="connected-build-abilities">{build.skills.map((skill, index) => <Ability key={index} {...skill} status={`Level ${value(skill.level)}`} />)}</div>{!build.skills.length && <p>No talent details were shared.</p>}</section>}
      {tab === 'Constellations' && <section className="section-block"><SectionTitle eyebrow="PROGRESSION" title="Constellations" description="Tap a constellation to read its full effect." /><div className="connected-build-abilities">{build.constellations.map((entry, index) => <Ability key={index} {...entry} status={entry.unlocked ? 'Unlocked' : 'Locked'} marker={`C${index + 1}`} />)}</div>{!build.constellations.length && <p>No constellation details were shared.</p>}</section>}
    </>}</div>)}
  </div>;
}
