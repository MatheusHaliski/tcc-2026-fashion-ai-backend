export type FashionCardRarity='COMMON'|'RARE'|'LEGENDARY'|'COLLAB_DROP';
export type AuraType='COMMON'|'ELECTRO'|'SPLASH'|'HYPE'|'METAMORPHOSE'|'IMPERSONATION';
export type PowerVfx='CYBERPUNK_ELECTRIC'|'COSMIC_GOLD'|'ELEMENTAL_FIRE'|'ELEMENTAL_WIND'|'Y2K_HOLOGRAM';
export interface AuraContextMetadata {brand:string;collaboration?:string;originCountry?:string;styleCategory?:string;occasion?:string;pattern?:string;sku?:string;modelCode?:string;brandId?:string}
export interface AuraVfxConfig {particleType:'ELECTRIC_ARCS'|'GOLD_DUST'|'WEATHER_MIST'|'NEON_GLITCH'|'SOFT_SPARKS';shaderOverlay:'CEL_SHADING'|'VHS_Y2K'|'CINEMATIC_LIGHTS'|'INFRARED_SCAN'|'SATIN_LIGHT';backgroundEnvironment:'MANGA_SPEEDLINES'|'TOKYO_CYBERPUNK'|'ALPINE_WEATHER'|'GALA_STAGE'|'RETRO_STREET'|'FASHION_STUDIO';powerVfx:PowerVfx;ruleVersion:number}
export interface FashionCardStats {versatility:number|null;hypeIndex:number|null;legacyScore:number|null}
export interface ImpersonationData {userMediaUrl:string;motionTemplateId:string;powerVfx:PowerVfx;renderedCardMediaUrl:string;renderedMediaType:'video/mp4'|'video/webm'|'image/gif';posterUrl:string;status:'MOCK_PREVIEW'|'READY';jobId:string}
export interface FashionCard {rarity:FashionCardRarity;auraType:AuraType;stats:FashionCardStats;serialNumber?:string;motionTemplateId?:string;cardMediaUrl?:string;impersonationData?:ImpersonationData;contextVfx?:AuraVfxConfig;contextBadges?:string[]}
/** Shared preset contains product metadata and VFX only; never a user photograph or rendered identity. */
export interface AuraAnimationPreset {id:string;fingerprint:string;config:AuraVfxConfig}
/** Personalized projection, separate from the canonical public catalog product. */
export interface OwnedFashionCard {ownerId:string;entityType:'PRODUCT'|'PIECE'|'LOOK';entityId:string;revision:number;metadata:AuraContextMetadata;auraPresetId?:string;fashionCard:FashionCard}
export function validStat(value:unknown):value is number|null{return value===null||typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;}
export function safeMediaUrl(value:string):boolean {if(!value||/[\\\u0000-\u0020]/.test(value))return false;if(value.startsWith('/')&&!value.startsWith('//'))return !value.includes('..');try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
