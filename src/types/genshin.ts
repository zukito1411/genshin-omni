export type ElementName = 'Anemo' | 'Geo' | 'Electro' | 'Dendro' | 'Hydro' | 'Pyro' | 'Cryo' | string;
export interface GenshinCharacter { id:string; name:string; rarity?:number; element?:ElementName; weapon?:string; region?:string; birthday?:string; title?:string; description?:string; quote?:string; images:{card:string;icon:string;portrait:string;gacha?:string}; raw:Record<string,unknown>; }
export interface DataSourceStamp { provider:string; url:string; fetchedAt:number; cached?:boolean; }
export interface AggregatedCharacter extends GenshinCharacter { stats:Record<string,unknown>; secondary:Record<string,unknown>; sources:DataSourceStamp[]; }
export interface TalentEntry { name:string; type?:string; description?:string; icon?:string; level?:number; raw?:Record<string,unknown>; }
export interface ConstellationEntry { name:string; description?:string; level?:number; icon?:string; }
export interface MaterialRef { name:string; amount?:number; icon?:string; source?:string; category?:string; }
export interface CharacterGuide { characterId:string; role:string[]; summary:string; statPriority:string[]; talentPriority:string[]; weapons:Array<{name:string;tier:string;note:string;source?:string}>; artifacts:Array<{set:string;pieces:string;note:string;source?:string}>; mainStats:{sands:string;goblet:string;circlet:string}; teams:Array<{name:string;members:string[];note:string;source?:string}>; caveats?:string[]; sourceLinks?:Array<{label:string;url:string}>; }
export interface MapMarker { id:string; name:string; category:string; region:string; x:number; y:number; note?:string; }
export interface FAQItem { question:string; answer:string; tags:string[]; }
export interface LibraryEntity { id:string; name:string; rarity?:number; type?:string; description?:string; icon:string; raw:Record<string,unknown>; }
