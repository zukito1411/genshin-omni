import { ExternalLink, Info } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { sources } from '../data/sources';

export function SourcesPage() {
  return <div>
    <SectionTitle eyebrow="REFERENCES & CREDITS" title="Sources" description="Explore the community references behind character information, build recommendations, and artwork." />
    <div className="source-grid">{sources.map((source) => <article className="panel source-card" key={source.name}><div className="eyebrow">REFERENCE</div><h3>{source.name}</h3><p>{source.purpose}</p><a className="source-button" href={source.url} target="_blank" rel="noreferrer">Visit reference <ExternalLink size={13} /></a></article>)}</div>
    <section className="panel boundary-panel"><Info size={18} /><div><h3>Choose a build that fits your playstyle</h3><p>Recommendations are a starting point. Your available weapons, artifacts, teammates, and the current game version can change which build works best.</p><p>Follow the guide links for more detailed explanations. Missing information is left unavailable rather than guessed.</p></div></section>
    <section className="callout"><div><div className="eyebrow">YOUR SAVED PLANS</div><h3>Keep your adventure organized</h3><p>Your roster, saved teams, favorites, and farming checks stay in this browser on this device. Clearing this site's saved data removes them.</p></div></section>
  </div>;
}
