import { useState, type MouseEvent } from 'react';
import { ExternalLink, MapPinned, RotateCcw, Trash2 } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { starterMarkers } from '../data/mapMarkers';
import type { MapMarker } from '../types/genshin';

interface PersonalPin extends MapMarker { createdAt:number }
const KEY='teyvat-atlas:personal-pins';
function readPins():PersonalPin[]{try{return JSON.parse(localStorage.getItem(KEY)??'[]')}catch{return []}}

export function MapPage(){
 const [pins,setPins]=useState<PersonalPin[]>(readPins);
 const [adding,setAdding]=useState(false);
 const [category,setCategory]=useState('Personal');
 function persist(next:PersonalPin[]){setPins(next);localStorage.setItem(KEY,JSON.stringify(next))}
 function reset(){persist([])}
 function addPin(event:MouseEvent<HTMLDivElement>){if(!adding)return;const rect=event.currentTarget.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width;const y=(event.clientY-rect.top)/rect.height;const name=window.prompt('Pin name','My farming spot');if(!name)return;persist([...pins,{id:`pin-${Date.now()}`,name,category,region:'Personal',x,y,createdAt:Date.now()}]);setAdding(false)}
 function remove(id:string){persist(pins.filter(pin=>pin.id!==id))}
 const displayMarkers=[...starterMarkers,...pins];
 return <div><SectionTitle eyebrow="EXPLORATION" title="Interactive Map & Personal Progress" description="Use the full community map for comprehensive world coverage. The local layer is deliberately user-owned: add your own pins and keep them in browser storage instead of relying on made-up coordinates." />
   <section className="map-embed panel"><div className="map-embed-head"><div><div className="eyebrow">FULL WORLD MAP</div><h3>GenshinMap</h3></div><a className="source-button" href="https://genshinmap.github.io/" target="_blank" rel="noreferrer">Open full map <ExternalLink size={13}/></a></div><iframe title="GenshinMap" src="https://genshinmap.github.io/" loading="lazy" referrerPolicy="no-referrer" /></section>
   <section className="section-block"><SectionTitle eyebrow="PERSONAL LAYER" title="Your own map notes" description="Add farming spots, puzzle reminders, respawn notes or anything else you want to remember. Pins never leave this browser." action={<div className="hero-actions"><button className={`button ${adding?'primary':'secondary'}`} onClick={()=>setAdding(v=>!v)}><MapPinned size={14}/>{adding?'Click the map to place':'Add personal pin'}</button><button className="button secondary" onClick={reset} disabled={!pins.length}><RotateCcw size={14}/> Reset</button></div>} />
    <div className={`tracker-panel panel ${adding?'pin-mode':''}`}><div className="tracker-toolbar"><span className="muted">{pins.length} personal pins</span><span className="muted">{adding?'Click anywhere on the map below.':'Stored locally in your browser.'}</span></div><div className="world-canvas" onClick={addPin}>{['Mondstadt','Liyue','Inazuma','Sumeru','Fontaine','Nod-Krai'].map((label,index)=><span key={label} className={`world-label world-${index+1}`}>{label}</span>)}{displayMarkers.map(marker=><button key={marker.id} className="world-marker" style={{left:`${marker.x*100}%`,top:`${marker.y*100}%`}} title={marker.name} onClick={(e)=>{e.stopPropagation();if('createdAt' in marker)remove(marker.id)}}>{'createdAt' in marker?<Trash2 size={13}/>:<MapPinned size={13}/>}</button>)}</div><div className="tracker-legend"><span><i className="legend-dot"/> Your pins</span><small>{adding?'Map click mode is active.':'The real world map above contains the full community marker dataset.'}</small></div></div></section>
  </div>
}
