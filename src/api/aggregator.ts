import { fetchCharacter, fetchFolder, fetchStats } from './genshinDb';
import { characterImageSources, fetchEntityDetail } from './genshinDev';
import type { AggregatedCharacter } from '../types/genshin';

export async function fetchAggregatedCharacter(query:string,signal?:AbortSignal):Promise<AggregatedCharacter>{
 const base=await fetchCharacter(query,signal);
 const [stats,secondary,talents,constellations]=await Promise.allSettled([
   fetchStats('characters',base.name||query,signal),
   fetchEntityDetail('characters',base.name||query,signal),
   fetchFolder('talents',base.name||query,signal),
   fetchFolder('constellations',base.name||query,signal),
 ]);
 const imageCandidates = characterImageSources(base, 'card');
 const dev=secondary.status==='fulfilled' && secondary.value && typeof secondary.value==='object' ? secondary.value : {};
 return {
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
}
