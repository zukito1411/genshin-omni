import { fetchCharacter, fetchFolder, fetchStats } from './genshinDb';
import { characterImageSources, fetchEntityDetail } from './genshinDev';
import type { AggregatedCharacter } from '../types/genshin';

const characterMemory = new Map<string, AggregatedCharacter>();
const characterRequests = new Map<string, Promise<AggregatedCharacter>>();

export async function fetchAggregatedCharacter(query:string,signal?:AbortSignal):Promise<AggregatedCharacter>{
 const key=query.trim().toLowerCase();
 const cached=characterMemory.get(key);
 if(cached)return cached;
 const shared=characterRequests.get(key);
 if(shared)return shared;
 const request=(async()=>{
 // This complete character record is shared and cached across navigation. Do
 // not bind it to a page-owned abort signal, or React's route cleanup can
 // cancel the request that the next visit is already waiting for.
 void signal;
 const base=await fetchCharacter(query);
 const [stats,secondary,talents,constellations]=await Promise.allSettled([
   fetchStats('characters',base.name||query),
   fetchEntityDetail('characters',base.name||query),
   fetchFolder('talents',base.name||query),
   fetchFolder('constellations',base.name||query),
 ]);
 const imageCandidates = characterImageSources(base, 'card');
 const dev=secondary.status==='fulfilled' && secondary.value && typeof secondary.value==='object' ? secondary.value : {};
 const result={
   ...base,
   images:{
     ...base.images,
     card:base.images.card||imageCandidates[0]||'',
     portrait:base.images.portrait||imageCandidates[1]||'',
   },
   stats:stats.status==='fulfilled'?stats.value:{},
   secondary:{dev,talents:talents.status==='fulfilled'?talents.value:null,constellations:constellations.status==='fulfilled'?constellations.value:null},
   sources:[
     {provider:'GenshinDB',url:'https://genshin-db-api.vercel.app/',fetchedAt:Date.now()},
     {provider:'genshin.dev / public image CDNs',url:'https://github.com/genshindev/api',fetchedAt:Date.now()},
   ],
 };
 // Keep retrying incomplete enrichments on future calls. A transient source
 // failure must not become the permanent in-memory representation of a
 // character for the rest of the session.
 if(stats.status==='fulfilled' && secondary.status==='fulfilled') characterMemory.set(key,result);
 return result;
 })().finally(()=>characterRequests.delete(key));
 characterRequests.set(key,request);
 return request;
}
