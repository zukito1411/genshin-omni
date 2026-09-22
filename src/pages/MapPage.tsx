import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { ExternalLink, MapPinned, RotateCcw, Search, Trash2 } from 'lucide-react';
import { fetchLiveMapMarkers, type LiveMapMarker } from '../api/mapData';
import { SectionTitle } from '../components/SectionTitle';
import { starterMarkers } from '../data/mapMarkers';
import type { MapMarker } from '../types/genshin';

interface PersonalPin extends MapMarker { createdAt:number }
const KEY='teyvat-atlas:personal-pins';
const MAPGENIE_URL = 'https://mapgenie.io/genshin-impact/maps/teyvat';
function readPins():PersonalPin[]{try{return JSON.parse(localStorage.getItem(KEY)??'[]')}catch{return []}}

export function MapPage(){
 const [pins,setPins]=useState<PersonalPin[]>(readPins);
 const [adding,setAdding]=useState(false);
 const [draftPosition,setDraftPosition]=useState<{x:number;y:number}|null>(null);
 const [pinName,setPinName]=useState('');
 const [pinNote,setPinNote]=useState('');
 const [category]=useState('Personal');
 const [mapSearch,setMapSearch]=useState('');
 const [liveMarkers,setLiveMarkers]=useState<LiveMapMarker[]>([]);
 const [mapLoading,setMapLoading]=useState(true);
 const [mapError,setMapError]=useState<string|null>(null);
 const [selectedMarker,setSelectedMarker]=useState<LiveMapMarker|null>(null);
 const [selectedMapId,setSelectedMapId]=useState<number|null>(null);
 useEffect(()=>{
   const controller=new AbortController();
   setMapLoading(true);setMapError(null);
   fetchLiveMapMarkers(controller.signal).then((markers)=>{
     setLiveMarkers(markers);
     const counts=new Map<number,number>();markers.forEach((marker)=>counts.set(marker.mapId,(counts.get(marker.mapId)??0)+1));
     setSelectedMapId([...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??null);
   }).catch((error)=>{
     if(error?.name!=='AbortError')setMapError(error instanceof Error?error.message:'Unable to load community map data.');
   }).finally(()=>{if(!controller.signal.aborted)setMapLoading(false)});
   return ()=>controller.abort();
 },[]);
 function persist(next:PersonalPin[]){setPins(next);localStorage.setItem(KEY,JSON.stringify(next))}
 function reset(){persist([])}
 function submitMapSearch(event?:FormEvent){event?.preventDefault()}
 function clearMapSearch(){setMapSearch('');setSelectedMarker(null)}
 function addPin(event:MouseEvent<HTMLDivElement>){if(!adding||draftPosition)return;const rect=event.currentTarget.getBoundingClientRect();setDraftPosition({x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height});setPinName('My farming spot');setPinNote('')}
 function savePin(event:FormEvent){event.preventDefault();if(!draftPosition||!pinName.trim())return;persist([...pins,{id:`pin-${Date.now()}`,name:pinName.trim(),note:pinNote.trim()||undefined,category,region:'Personal',...draftPosition,createdAt:Date.now()}]);setDraftPosition(null);setAdding(false)}
 function cancelPin(){setDraftPosition(null);setAdding(false)}
 function remove(id:string){persist(pins.filter(pin=>pin.id!==id))}
 const displayMarkers=[...starterMarkers,...pins];
 const mapLayers=useMemo(()=>{const counts=new Map<number,number>();liveMarkers.forEach((marker)=>counts.set(marker.mapId,(counts.get(marker.mapId)??0)+1));return [...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([id,count])=>({id,count}))},[liveMarkers]);
 const activeMapId=selectedMapId??mapLayers[0]?.id??null;
 const matchedMarkers=useMemo(()=>{const query=mapSearch.trim().toLowerCase();return liveMarkers.filter((marker)=>(activeMapId===null||marker.mapId===activeMapId)&&(!query||`${marker.name} ${marker.type} ${marker.mapId}`.toLowerCase().includes(query)))},[liveMarkers,mapSearch,activeMapId]);
 const visibleMarkers=useMemo(()=>{const limit=1200;if(matchedMarkers.length<=limit)return matchedMarkers;const step=Math.ceil(matchedMarkers.length/limit);return matchedMarkers.filter((_,index)=>index%step===0).slice(0,limit)},[matchedMarkers]);
 return <div><SectionTitle eyebrow="EXPLORATION" title="Interactive Map & Personal Progress" description="Find resources, bosses, specialties and exploration markers, then keep your own farming notes in this browser." />
   <section className="map-embed panel"><div className="map-embed-head"><div><div className="eyebrow">WORLD MAP</div><h3>Community marker map</h3></div><a className="source-button" href={MAPGENIE_URL} target="_blank" rel="noreferrer">Open MapGenie <ExternalLink size={13}/></a></div>
     <form className="map-search" onSubmit={submitMapSearch}><Search size={15}/><input value={mapSearch} onChange={(e)=>setMapSearch(e.target.value)} placeholder="Search chests, shrines, time trials, crimson agate..." /><select aria-label="Map layer" value={activeMapId??''} onChange={(e)=>{setSelectedMapId(Number(e.target.value));setSelectedMarker(null)}}>{mapLayers.map((layer)=><option key={layer.id} value={layer.id}>Map layer {layer.id} ({layer.count.toLocaleString()})</option>)}</select><button className="button primary" type="submit">Search</button><button type="button" className="button secondary" onClick={clearMapSearch} disabled={!mapSearch}>Clear</button></form>
     <div className="live-map-wrap">
      {mapLoading&&<div className="map-loading-state"><div className="map-loading-spinner"/><strong>Loading community markersâ€¦</strong><span>Downloading the current public marker data for this local map.</span></div>}
      {mapError&&<div className="map-loading-state"><strong>The marker data could not be loaded.</strong><span>{mapError}</span><button className="button primary" onClick={()=>window.location.reload()}>Retry</button></div>}
      {!mapLoading&&!mapError&&<div className="live-map-canvas"><span className="world-label world-1">Map layer {activeMapId ?? '—'}</span>{visibleMarkers.map((marker)=><button type="button" className={`live-map-marker ${selectedMarker?.id===marker.id?'selected':''}`} key={marker.id} style={{left:`${marker.x*100}%`,top:`${marker.y*100}%`}} title={marker.name} onClick={()=>setSelectedMarker(marker)}><MapPinned size={11}/></button>)}{selectedMarker&&<div className="live-map-detail"><strong>{selectedMarker.name}</strong><span>Map {selectedMarker.mapId} / level {selectedMarker.level}</span><button type="button" onClick={()=>setSelectedMarker(null)}>Close</button></div>}</div>}
     </div>
     <div className="map-help"><span>{mapLoading?'Loading markers…':`${matchedMarkers.length.toLocaleString()} matching markers / showing ${visibleMarkers.length}`}</span><span>Coordinates are normalized per map layer. Click a pin for details.</span></div>
   </section>
   <section className="section-block"><SectionTitle eyebrow="PERSONAL LAYER" title="Your own map notes" description="Add farming spots, puzzle reminders, respawn notes or anything else you want to remember. Pins stay in this browser." action={<div className="hero-actions"><button className={`button ${adding?'primary':'secondary'}`} onClick={()=>{setAdding(v=>!v);setDraftPosition(null)}}><MapPinned size={14}/>{adding?'Cancel pin':'Add personal pin'}</button><button className="button secondary" onClick={reset} disabled={!pins.length}><RotateCcw size={14}/> Reset</button></div>} />
    <div className={`tracker-panel panel ${adding?'pin-mode':''}`}><div className="tracker-toolbar"><span className="muted">{pins.length} personal pins</span><span className="muted">{adding?'Click a location to add a note.':'Select Add personal pin to start.'}</span></div><div className="world-canvas" onClick={addPin}>{['Mondstadt','Liyue','Inazuma','Sumeru','Fontaine','Nod-Krai'].map((label,index)=><span key={label} className={`world-label world-${index+1}`}>{label}</span>)}{displayMarkers.map(marker=><button type="button" key={marker.id} className="world-marker" style={{left:`${marker.x*100}%`,top:`${marker.y*100}%`}} title={marker.note?`${marker.name}: ${marker.note}`:marker.name} onClick={(e)=>{e.stopPropagation();if('createdAt' in marker)remove(marker.id)}}>{'createdAt' in marker?<Trash2 size={13}/>:<MapPinned size={13}/>}</button>)}{draftPosition&&<form className="pin-editor" style={{left:`${draftPosition.x*100}%`,top:`${draftPosition.y*100}%`}} onClick={(event)=>event.stopPropagation()} onSubmit={savePin}><label>Name<input autoFocus value={pinName} onChange={(event)=>setPinName(event.target.value)} placeholder="My farming spot" /></label><label>Note<textarea value={pinNote} onChange={(event)=>setPinNote(event.target.value)} placeholder="Respawn time, puzzle hintâ€¦" /></label><div><button className="button primary" type="submit">Save pin</button><button className="button secondary" type="button" onClick={cancelPin}>Cancel</button></div></form>}</div><div className="tracker-legend"><span><i className="legend-dot"/> Your pins</span><small>{adding?'Map click mode is active. Click one of your pins to remove it.':'Pins and notes are stored only on this device.'}</small></div></div></section>
  </div>
}
