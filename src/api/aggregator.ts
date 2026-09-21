import { fetchCharacter, fetchFolder, fetchStats } from './genshinDb';
import { characterImages, fetchEntityDetail } from './genshinDev';
import type { AggregatedCharacter } from '../types/genshin';
export async function fetchAggregatedCharacter(query:string,signal?:AbortSignal):Promise<AggregatedCharacter>{
 const base=await fetchCharacter(query,signal);
 const [stats,secondary, talents, constellations]=await Promise.allSettled([fetchStats('characters',base.name||query,signal),fetchEntityDetail('characters',base.name||query,signal),fetchFolder('talents',base.name||query,signal),fetchFolder('constellations',base.name||query,signal)]);
 const imgs=characterImages(base.id||base.name||query);
 return {...base,images:{icon:base.images.icon||imgs.icon,card:base.images.card||imgs.card,portrait:base.images.portrait||imgs.portrait},stats:stats.status==='fulfilled'?stats.value:{},secondary:{dev:secondary.status==='fulfilled'?secondary.value:{},talents:talents.status==='fulfilled'?talents.value:null,constellations:constellations.status==='fulfilled'?constellations.value:null},sources:[{provider:'GenshinDB',url:'https://genshin-db-api.vercel.app/',fetchedAt:Date.now()},{provider:'genshin.dev',url:'https://genshin.jmp.blue/',fetchedAt:Date.now()}]};
}
