import { getJson } from './http';
import { slugify } from '../utils/normalize';

const BASE_URL = import.meta.env.VITE_GENSHIN_IMAGES_API ?? '/api/genshin-dev';

export function genshinDevId(nameOrId:string){return slugify(nameOrId)}

export function entityImage(type:string,id:string,imageType='icon'){
  const normalized = slugify(id);
  return `${BASE_URL}/${type}/${encodeURIComponent(normalized)}/${encodeURIComponent(imageType)}`;
}

export async function fetchEntityDetail(type:string,nameOrId:string,signal?:AbortSignal){
  const id=genshinDevId(nameOrId);
  return getJson<Record<string,unknown>>(`${BASE_URL}/${type}/${encodeURIComponent(id)}?lang=en`,signal,{cacheKey:`dev:${type}:${id}`,ttlMs:12*60*60*1000});
}

export function characterImages(nameOrId:string){
  const id=genshinDevId(nameOrId);
  return {
    icon:entityImage('characters',id,'icon'),
    card:entityImage('characters',id,'card'),
    portrait:entityImage('characters',id,'portrait'),
    gacha:entityImage('characters',id,'gacha-card'),
  };
}
