const PREFIX = 'teyvat-atlas:v5:';
interface Entry<T>{expiresAt:number;value:T;updatedAt:number}
export function readCache<T>(key:string):{value:T;stale:boolean;updatedAt:number}|null{
  try{
    const raw=localStorage.getItem(PREFIX+key);
    if(!raw)return null;
    const entry=JSON.parse(raw) as Entry<T>;
    return {value:entry.value,stale:Date.now()>entry.expiresAt,updatedAt:entry.updatedAt};
  }catch{return null}
}
export function writeCache<T>(key:string,value:T,ttlMs:number):void{
  try{
    localStorage.setItem(PREFIX+key,JSON.stringify({expiresAt:Date.now()+ttlMs,value,updatedAt:Date.now()} satisfies Entry<T>));
  }catch{}
}
export function clearAppCache():void{
  try{Object.keys(localStorage).filter(k=>k.startsWith(PREFIX)).forEach(k=>localStorage.removeItem(k));}catch{}
}
