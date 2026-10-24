import type {AuraHypeCardLevel} from './types';
export type HypePresetKind='static'|'dynamic';
export const HYPE_LAYOUTS=['static-horizontal','static-vertical','static-columns','static-global','ranked-bars','extremes','momentum','key-triad'] as const;
export type HypeLayout=typeof HYPE_LAYOUTS[number]|'grid'|'list'|'strip'|'stack';
/** Cosmetic finish, not an override of the server's fashionCard classification or the user's XP. */
const FINISHES=[
 {tier:'COMMON'},
 {tier:'RARE'},
 {tier:'LEGENDARY'},
 {tier:'COLLAB_DROP'},
] as const;
export function hypePresetsForTier(tier:AuraHypeCardLevel){
 const finish=FINISHES.find(f=>f.tier===tier)??FINISHES[0];
 return HYPE_LAYOUTS.map((layout,index)=>({
 ...finish,color:'#e5e5e5',secondary:'#b8b8b8',id:`${finish.tier}_${layout.toUpperCase().replaceAll('-','_')}`,layout,
 kind:(index<4?'static':'dynamic') as HypePresetKind,
 tech:['SCAN','CONTOUR','MESH','HOLO','FIBER','PRISM','PARTICLES','SPOTLIGHT'][index],
 palette:finish.tier,duration:8,spacing:20,angle:45,
 effect:(index<4?'METRICS':index===6?'STARS':'SCANNER'),
}));
}
export const HYPE_PRESETS=hypePresetsForTier('COMMON');
// Old choices continue to render, but are no longer offered as 40 almost identical options.
export const HYPE_TECHS=['SCAN','CONTOUR','MESH','HOLO','FIBER','PRISM','PARTICLES','SPOTLIGHT'] as const;
export const HYPE_PALETTES=[{id:'GRAPHITE',color:'#77e6df',secondary:'#75a7d8'},{id:'CHROME',color:'#b6ddec',secondary:'#d8c8e6'},{id:'ROSE',color:'#e6b5ca',secondary:'#bca5de'},{id:'VIOLET',color:'#bd9ef0',secondary:'#92d1ed'},{id:'CHAMPAGNE',color:'#ebd1a3',secondary:'#d8b9cb'}] as const;
const LEGACY:Record<string,string>={SCANNER:'SCAN_GRAPHITE',XRAY:'CONTOUR_CHROME',DOTS:'PARTICLES_GRAPHITE',STARS:'PARTICLES_CHAMPAGNE',METRICS:'MESH_GRAPHITE'};
export function hypePreset(mode?:string){
 const found=FINISHES.flatMap(f=>hypePresetsForTier(f.tier)).find(p=>p.id===mode);if(found)return found;
 const old=LEGACY[mode??'']??mode;
 const tech=HYPE_TECHS.find(t=>old?.startsWith(`${t}_`));const palette=HYPE_PALETTES.find(p=>old?.endsWith(`_${p.id}`));
 if(tech&&palette){const layout=HYPE_LAYOUTS[HYPE_TECHS.indexOf(tech)];return {...HYPE_PRESETS[0],...palette,id:old!,palette:palette.id,tech,layout,kind:(HYPE_TECHS.indexOf(tech)<4?'static':'dynamic') as HypePresetKind,tier:'COMMON' as AuraHypeCardLevel};}
 return HYPE_PRESETS[0];
}
