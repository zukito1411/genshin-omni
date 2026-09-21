import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { faqs } from '../data/faqs';
import { guides } from '../data/guides';

const externalGuides = [
  ['KeqingMains', 'https://keqingmains.com/', 'Detailed theorycrafting and character guides.'],
  ['Prydwen', 'https://www.prydwen.gg/genshin/', 'Community build pages and up-to-date character references.'],
  ['Game8', 'https://game8.co/games/Genshin-Impact', 'Beginner-oriented guides, quests and materials.'],
  ['Honey Hunter', 'https://gensh.honeyhunterworld.com/', 'Detailed data and numerical references.'],
  ['Genshin Wiki', 'https://genshin-impact.fandom.com/wiki/Genshin_Impact_Wiki', 'Broad lore, mechanics and item reference.'],
];

export function GuidesPage() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => faqs.filter((faq) => `${faq.question} ${faq.answer} ${faq.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <div><SectionTitle eyebrow="KNOWLEDGE BASE" title="Guides, FAQ & Reference Hub" description="Factual game data comes from structured providers; opinionated build guidance remains clearly labeled and linked back to community sources." /><div className="toolbar"><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions..." /></div><div className="faq-grid">{results.map((faq) => <details className="panel faq" key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p><div className="tag-row">{faq.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</div></details>)}</div><section className="section-block"><SectionTitle eyebrow="COMMUNITY" title="External guide network" /><div className="source-grid">{externalGuides.map(([name, url, description]) => <article className="panel source-card" key={name}><div className="eyebrow">REFERENCE</div><h3>{name}</h3><p>{description}</p><a className="source-button" href={url} target="_blank" rel="noreferrer">Open {name} <ExternalLink size={13} /></a></article>)}</div></section><section className="section-block"><SectionTitle eyebrow="CURATED" title="Maintained build overrides" description="Only characters with a manually reviewed guide file are shown here. The rest use source links instead of made-up rankings." /><div className="stack-list">{Object.values(guides).map((guide) => <div className="list-row" key={guide.characterId}><div><strong>{guide.characterId}</strong><span>{guide.summary}</span></div><em>{guide.role.join(' · ')}</em></div>)}</div></section></div>;
}
