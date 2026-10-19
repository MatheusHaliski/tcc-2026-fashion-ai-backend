export const HYPE_TECHS=['SCAN','CONTOUR','MESH','HOLO','FIBER','PRISM','PARTICLES','SPOTLIGHT'] as const;
export type HypePresetKind='static'|'dynamic';
/** Cards estáticos priorizam uma leitura fixa; cards dinâmicos usam movimento/ênfase temporal. */
const HYPE_DYNAMIC_TECHS=new Set<typeof HYPE_TECHS[number]>(['FIBER','PRISM','PARTICLES','SPOTLIGHT']);
export const HYPE_PALETTES=[
 {id:'GRAPHITE',color:'#77e6df',secondary:'#75a7d8'},
 {id:'CHROME',color:'#b6ddec',secondary:'#d8c8e6'},
 {id:'ROSE',color:'#e6b5ca',secondary:'#bca5de'},
 {id:'VIOLET',color:'#bd9ef0',secondary:'#92d1ed'},
 {id:'CHAMPAGNE',color:'#ebd1a3',secondary:'#d8b9cb'},
] as const;
/**
 * Forma de apresentação dos números Hype. Os layouts públicos não mudam a fonte dos dados:
 * eles apenas reorganizam o snapshot atual recebido do servidor.
 */
export type HypeLayout='grid'|'list'|'strip'|'stack'|'static-horizontal'|'static-vertical'|'static-columns'|'static-global'|'ranked-bars'|'extremes'|'momentum'|'key-triad';
const HYPE_LAYOUT:Record<typeof HYPE_TECHS[number],HypeLayout>={SCAN:'grid',CONTOUR:'list',MESH:'grid',HOLO:'strip',FIBER:'list',PRISM:'strip',PARTICLES:'stack',SPOTLIGHT:'stack'};
export const HYPE_PRESETS=HYPE_TECHS.flatMap((tech,i)=>HYPE_PALETTES.map((palette,j)=>({
 id:`${tech}_${palette.id}`,tech,palette:palette.id,color:palette.color,secondary:palette.secondary,
 kind:HYPE_DYNAMIC_TECHS.has(tech)?'dynamic':'static',
 duration:7+j*2,spacing:16+i*2+j,angle:30+i*17+j*9,
 layout:HYPE_LAYOUT[tech],
 effect:({SCAN:'SCANNER',CONTOUR:'XRAY',MESH:'METRICS',HOLO:'XRAY',FIBER:'DOTS',PRISM:'XRAY',PARTICLES:'STARS',SPOTLIGHT:'SCANNER'} as const)[tech],
})));
const LEGACY:Record<string,string>={SCANNER:'SCAN_GRAPHITE',XRAY:'CONTOUR_CHROME',DOTS:'PARTICLES_GRAPHITE',STARS:'PARTICLES_CHAMPAGNE',METRICS:'MESH_GRAPHITE'};
export function hypePreset(mode?:string){return HYPE_PRESETS.find(p=>p.id===(LEGACY[mode??'']??mode))??HYPE_PRESETS[0];}
