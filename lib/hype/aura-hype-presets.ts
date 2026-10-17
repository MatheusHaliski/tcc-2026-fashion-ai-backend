export const HYPE_TECHS=['SCAN','CONTOUR','MESH','HOLO','FIBER','PRISM','PARTICLES','SPOTLIGHT'] as const;
export const HYPE_PALETTES=[
 {id:'GRAPHITE',color:'#77e6df',secondary:'#75a7d8'},
 {id:'CHROME',color:'#b6ddec',secondary:'#d8c8e6'},
 {id:'ROSE',color:'#e6b5ca',secondary:'#bca5de'},
 {id:'VIOLET',color:'#bd9ef0',secondary:'#92d1ed'},
 {id:'CHAMPAGNE',color:'#ebd1a3',secondary:'#d8b9cb'},
] as const;
export const HYPE_PRESETS=HYPE_TECHS.flatMap((tech,i)=>HYPE_PALETTES.map((palette,j)=>({
 id:`${tech}_${palette.id}`,tech,palette:palette.id,color:palette.color,secondary:palette.secondary,
 duration:7+j*2,spacing:16+i*2+j,angle:30+i*17+j*9,
 effect:({SCAN:'SCANNER',CONTOUR:'XRAY',MESH:'METRICS',HOLO:'XRAY',FIBER:'DOTS',PRISM:'XRAY',PARTICLES:'STARS',SPOTLIGHT:'SCANNER'} as const)[tech],
})));
const LEGACY:Record<string,string>={SCANNER:'SCAN_GRAPHITE',XRAY:'CONTOUR_CHROME',DOTS:'PARTICLES_GRAPHITE',STARS:'PARTICLES_CHAMPAGNE',METRICS:'MESH_GRAPHITE'};
export function hypePreset(mode?:string){return HYPE_PRESETS.find(p=>p.id===(LEGACY[mode??'']??mode))??HYPE_PRESETS[0];}
