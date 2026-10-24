import type {AuraContextMetadata,AuraVfxConfig,AuraAnimationPreset} from './types';
const normalized=(s?:string)=>s?.normalize('NFKD').replace(/\p{M}/gu,'').trim().replace(/\s+/g,' ').toUpperCase()??'';
export function canonicalAuraContext(m:AuraContextMetadata){return {ruleVersion:2,brand:normalized(m.brand),brandId:normalized(m.brandId),sku:normalized(m.sku),modelCode:normalized(m.modelCode),collaboration:normalized(m.collaboration),originCountry:normalized(m.originCountry),styleCategory:normalized(m.styleCategory),occasion:normalized(m.occasion),pattern:normalized(m.pattern),colorHex:normalized(m.colorHex),colorName:normalized(m.colorName)};}
export class AuraContextEngineService {
 resolve(metadata:AuraContextMetadata):AuraVfxConfig {
  const m=canonicalAuraContext(metadata);const pop=m.originCountry==='JP'&&/POKEMON|ANIME/.test(m.collaboration);const outdoor=/TECHWEAR|GORPCORE|OUTDOOR/.test(m.styleCategory);const y2k=/Y2K|SKATE/.test(m.styleCategory);const gala=/GALA|FORMAL|RED_CARPET/.test(m.occasion);
  return {ruleVersion:2,palette:[/^#[0-9A-F]{6}$/.test(m.colorHex)?m.colorHex:gala?'#D6B367':y2k?'#DE77E8':'#77D9ED',gala?'#FFF1BD':outdoor?'#86DEBB':'#A391F0'],particleType:pop?'ELECTRIC_ARCS':gala?'GOLD_DUST':outdoor?'WEATHER_MIST':y2k?'NEON_GLITCH':'SOFT_SPARKS',shaderOverlay:y2k?'VHS_Y2K':pop?'CEL_SHADING':gala?'CINEMATIC_LIGHTS':outdoor?'INFRARED_SCAN':'SATIN_LIGHT',backgroundEnvironment:pop?'MANGA_SPEEDLINES':outdoor&&m.originCountry==='JP'?'TOKYO_CYBERPUNK':gala?'GALA_STAGE':outdoor?'ALPINE_WEATHER':y2k?'RETRO_STREET':'FASHION_STUDIO',powerVfx:pop?'CYBERPUNK_ELECTRIC':gala?'COSMIC_GOLD':outdoor?'ELEMENTAL_WIND':y2k?'Y2K_HOLOGRAM':'COSMIC_GOLD'};
 }
 async fingerprint(metadata:AuraContextMetadata):Promise<string>{const bytes=new TextEncoder().encode(JSON.stringify(canonicalAuraContext(metadata)));const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
 badges(m:AuraContextMetadata):string[]{return [[m.brand,m.collaboration].filter(Boolean).join(' × '),m.originCountry?.toUpperCase(),m.styleCategory,m.occasion].filter((s):s is string=>!!s).slice(0,4);}
}
export interface AuraPresetRepository {get(id:string):Promise<AuraAnimationPreset|null>;save(preset:AuraAnimationPreset):Promise<void>}
/** Prototype cache; inject persistent storage in the production worker/backend. */
export class InMemoryAuraPresetRepository implements AuraPresetRepository {
 private entries=new Map<string,AuraAnimationPreset>();
 constructor(private maximum=256){if(!Number.isInteger(maximum)||maximum<1)throw Error('INVALID_CACHE_SIZE');}
 async get(id:string){const p=this.entries.get(id);if(!p)return null;this.entries.delete(id);this.entries.set(id,p);return structuredClone(p);}
 async save(p:AuraAnimationPreset){this.entries.delete(p.id);this.entries.set(p.id,structuredClone(p));while(this.entries.size>this.maximum)this.entries.delete(this.entries.keys().next().value!);}
}
export class AuraPresetResolver {
 private inflight=new Map<string,Promise<AuraAnimationPreset>>();
 constructor(private engine:AuraContextEngineService,private repository:AuraPresetRepository){}
 async resolve(metadata:AuraContextMetadata,existingId?:string){
  const fingerprint=await this.engine.fingerprint(metadata);const id=`aura-v2-${fingerprint}`;
  if(existingId===id){const existing=await this.repository.get(id);if(existing?.fingerprint===fingerprint)return existing;}
  const cached=await this.repository.get(id);if(cached?.fingerprint===fingerprint)return cached;
  let pending=this.inflight.get(id);if(!pending){pending=(async()=>{const preset={id,fingerprint,config:this.engine.resolve(metadata)};await this.repository.save(preset);return preset;})();this.inflight.set(id,pending);}
  try{return await pending;}finally{if(this.inflight.get(id)===pending)this.inflight.delete(id);}
 }
}
