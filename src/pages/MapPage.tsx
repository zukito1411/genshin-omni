import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { ExternalLink, MapPinned, RotateCcw, Search, Trash2 } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { starterMarkers } from '../data/mapMarkers';
import type { MapMarker } from '../types/genshin';

interface PersonalPin extends MapMarker { createdAt:number }
const KEY='teyvat-atlas:personal-pins';
const DEFAULT_MAP_MARKERS = 'Statue of the Seven,Teleport Waypoint';
function readPins():PersonalPin[]{try{return JSON.parse(localStorage.getItem(KEY)??'[]')}catch{return []}}

export function MapPage(){
 const [pins,setPins]=useState<PersonalPin[]>(readPins);
 const [adding,setAdding]=useState(false);
 const [draftPosition,setDraftPosition]=useState<{x:number;y:number}|null>(null);
 const [pinName,setPinName]=useState('');
 const [pinNote,setPinNote]=useState('');
 const [category]=useState('Personal');
 const [mapSearch,setMapSearch]=useState('');
 const [mapQuery,setMapQuery]=useState(DEFAULT_MAP_MARKERS);
 const [mapLoaded,setMapLoaded]=useState(false);
 const [mapTimedOut,setMapTimedOut]=useState(false);
 const mapUrl=useMemo(()=>{
   const query=new URLSearchParams();
   query.set('names', mapQuery);
   query.set('no_heading', '1');
   return `https://genshin-impact-map.appsample.com/location?${query.toString()}`;
 },[mapQuery]);
 useEffect(()=>{
   setMapLoaded(false);
   setMapTimedOut(false);
   const timeout=window.setTimeout(()=>setMapTimedOut(true),15000);
   return ()=>window.clearTimeout(timeout);
 },[mapUrl]);
 function persist(next:PersonalPin[]){setPins(next);localStorage.setItem(KEY,JSON.stringify(next))}
 function reset(){persist([])}
 function submitMapSearch(event?:FormEvent){event?.preventDefault();const value=mapSearch.trim();setMapQuery(value||DEFAULT_MAP_MARKERS)}
 function clearMapSearch(){setMapSearch('');setMapQuery(DEFAULT_MAP_MARKERS)}
 function addPin(event:MouseEvent<HTMLDivElement>){if(!adding||draftPosition)return;const rect=event.currentTarget.getBoundingClientRect();setDraftPosition({x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height});setPinName('My farming spot');setPinNote('')}
 function savePin(event:FormEvent){event.preventDefault();if(!draftPosition||!pinName.trim())return;persist([...pins,{id:`pin-${Date.now()}`,name:pinName.trim(),note:pinNote.trim()||undefined,category,region:'Personal',...draftPosition,createdAt:Date.now()}]);setDraftPosition(null);setAdding(false)}
 function cancelPin(){setDraftPosition(null);setAdding(false)}
 function remove(id:string){persist(pins.filter(pin=>pin.id!==id))}
 const displayMarkers=[...starterMarkers,...pins];
 return <div><SectionTitle eyebrow="EXPLORATION" title="Interactive Map & Personal Progress" description="Find resources, bosses, specialties and exploration markers, then keep your own farming notes in this browser." />
   <section className="map-embed panel"><div className="map-embed-head"><div><div className="eyebrow">WORLD MAP</div><h3>Genshin Impact Interactive Map</h3></div><a className="source-button" href={mapUrl} target="_blank" rel="noreferrer">Open full map <ExternalLink size={13}/></a></div>
     <form className="map-search" onSubmit={submitMapSearch}><Search size={15}/><input value={mapSearch} onChange={(e)=>setMapSearch(e.target.value)} placeholder="Search a resource, boss, chest, specialty..." /><button className="button primary" type="submit">Search</button><button type="button" className="button secondary" onClick={clearMapSearch} disabled={!mapSearch}>Clear</button></form>
     <div className={`map-frame-wrap ${mapLoaded ? 'map-frame-wrap--loaded' : ''}`}>
      {!mapLoaded && !mapTimedOut && <div className="map-loading-state"><div className="map-loading-spinner"/><strong>Loading the interactive map…</strong><span>The community map loads its marker database and map tiles separately.</span></div>}
      {mapTimedOut && !mapLoaded && <div className="map-loading-state"><strong>The embedded map is unavailable in this browser.</strong><span>Use the button below to open the same searchable map directly in a new tab.</span><a className="button primary" href={mapUrl} target="_blank" rel="noreferrer">Open interactive map <ExternalLink size={13}/></a></div>}
      <iframe key={mapUrl} title="Genshin Impact Interactive Map" src={mapUrl} onLoad={()=>{setMapLoaded(true);setMapTimedOut(false)}} onError={()=>setMapTimedOut(true)} allowFullScreen />
     </div>
     <div className="map-help"><span>Search above changes the marker filter used by the map.</span><a href={mapUrl} target="_blank" rel="noreferrer">Open the same search in a new tab <ExternalLink size={12}/></a></div>
   </section>
   <section className="section-block"><SectionTitle eyebrow="PERSONAL LAYER" title="Your own map notes" description="Add farming spots, puzzle reminders, respawn notes or anything else you want to remember. Pins stay in this browser." action={<div className="hero-actions"><button className={`button ${adding?'primary':'secondary'}`} onClick={()=>{setAdding(v=>!v);setDraftPosition(null)}}><MapPinned size={14}/>{adding?'Cancel pin':'Add personal pin'}</button><button className="button secondary" onClick={reset} disabled={!pins.length}><RotateCcw size={14}/> Reset</button></div>} />
    <div className={`tracker-panel panel ${adding?'pin-mode':''}`}><div className="tracker-toolbar"><span className="muted">{pins.length} personal pins</span><span className="muted">{adding?'Click a location to add a note.':'Select Add personal pin to start.'}</span></div><div className="world-canvas" onClick={addPin}>{['Mondstadt','Liyue','Inazuma','Sumeru','Fontaine','Nod-Krai'].map((label,index)=><span key={label} className={`world-label world-${index+1}`}>{label}</span>)}{displayMarkers.map(marker=><button type="button" key={marker.id} className="world-marker" style={{left:`${marker.x*100}%`,top:`${marker.y*100}%`}} title={marker.note?`${marker.name}: ${marker.note}`:marker.name} onClick={(e)=>{e.stopPropagation();if('createdAt' in marker)remove(marker.id)}}>{'createdAt' in marker?<Trash2 size={13}/>:<MapPinned size={13}/>}</button>)}{draftPosition&&<form className="pin-editor" style={{left:`${draftPosition.x*100}%`,top:`${draftPosition.y*100}%`}} onClick={(event)=>event.stopPropagation()} onSubmit={savePin}><label>Name<input autoFocus value={pinName} onChange={(event)=>setPinName(event.target.value)} placeholder="My farming spot" /></label><label>Note<textarea value={pinNote} onChange={(event)=>setPinNote(event.target.value)} placeholder="Respawn time, puzzle hint…" /></label><div><button className="button primary" type="submit">Save pin</button><button className="button secondary" type="button" onClick={cancelPin}>Cancel</button></div></form>}</div><div className="tracker-legend"><span><i className="legend-dot"/> Your pins</span><small>{adding?'Map click mode is active. Click one of your pins to remove it.':'Pins and notes are stored only on this device.'}</small></div></div></section>
  </div>
}
