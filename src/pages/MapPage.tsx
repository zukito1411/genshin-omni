import { ExternalLink } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';

const OFFICIAL_MAP_URL = 'https://act.hoyolab.com/ys/app/interactive-map/index.html?lang=en-us#/map/2';

export function MapPage() {
  return <div className="official-map-page">
    <SectionTitle
      eyebrow="EXPLORATION / LOCAL DEVELOPMENT"
      title="Teyvat Interactive Map"
      description="The official HoYoLAB map includes teleport waypoints, Statues of The Seven, domains, bosses, gathering materials, and its own filters and account-linked progress."
      action={<a className="button secondary" href={OFFICIAL_MAP_URL} target="_blank" rel="noreferrer">Open official map <ExternalLink size={14} /></a>}
    />
    <section className="map-embed panel official-map-embed">
      <div className="map-embed-head">
        <div><div className="eyebrow">OFFICIAL HOYOLAB TOOL</div><h3>Genshin Impact Interactive Map</h3></div>
        <a className="source-button" href={OFFICIAL_MAP_URL} target="_blank" rel="noreferrer">Open in new tab <ExternalLink size={13} /></a>
      </div>
      <div className="official-map-frame-wrap">
        <iframe
          title="Official HoYoLAB Genshin Impact Interactive Map"
          src={OFFICIAL_MAP_URL}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen"
        />
      </div>
      <div className="map-help">
        <span>Use HoYoLAB's category filters to find waypoints, materials, bosses, domains, and more.</span>
        <a href={OFFICIAL_MAP_URL} target="_blank" rel="noreferrer">If the provider blocks embedding, open the official map directly <ExternalLink size={12} /></a>
      </div>
    </section>
  </div>;
}
