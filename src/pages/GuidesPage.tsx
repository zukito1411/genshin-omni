import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { faqs } from '../data/faqs';

const externalGuides = [
  ['KeqingMains', 'https://keqingmains.com/', 'Detailed theorycrafting and character guides.'],
  ['Genshin.gg', 'https://genshin.gg/builds/', 'Current character builds, weapons, artifacts, stats and team references.'],
  ['Genshin Builds', 'https://genshin-builds.com/', 'Character build pages with weapons, artifacts, stats and talent priorities.'],
  ['Prydwen', 'https://www.prydwen.gg/genshin/', 'Community build pages and character references.'],
  ['Genshin Wiki', 'https://genshin-impact.fandom.com/wiki/Genshin_Impact_Wiki', 'Broad lore, mechanics and item reference.'],
];

export function GuidesPage() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => faqs.filter((faq) => `${faq.question} ${faq.answer} ${faq.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <div>
    <SectionTitle eyebrow="KNOWLEDGE BASE" title="Guides, FAQ & Reference Hub" description="Teyvat Atlas keeps game facts inside the app and uses maintained public build sources for recommendation data." />
    <div className="toolbar"><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions..." /></div>
    <div className="faq-grid">{results.map((faq) => <details className="panel faq" key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p><div className="tag-row">{faq.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</div></details>)}</div>
    <section className="section-block"><SectionTitle eyebrow="PLAYER REFERENCES" title="Maintained public guide sources" description="These sources feed the player build information used throughout the app or provide additional reading when you want deeper theorycrafting." /><div className="source-grid">{externalGuides.map(([name, url, description]) => <article className="panel source-card" key={name}><div className="eyebrow">REFERENCE</div><h3>{name}</h3><p>{description}</p><a className="source-button" href={url} target="_blank" rel="noreferrer">Open {name} <ExternalLink size={13} /></a></article>)}</div></section>
  </div>;
}
