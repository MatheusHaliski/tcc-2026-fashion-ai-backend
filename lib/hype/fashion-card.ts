import type {AuraHypeCardLevel,HypeSummary} from './types';
export const AURA_HYPE_CARD_LEVELS=['COMMON','RARE','LEGENDARY','COLLAB_DROP'] as const;
export function fashionCardLevel(summary?:HypeSummary|null):AuraHypeCardLevel|null {
 const c=summary?.fashionCard;
 if(c?.status!=='CLASSIFIED'||!AURA_HYPE_CARD_LEVELS.includes(c.tier as AuraHypeCardLevel))return null;
 if(c.tier==='COLLAB_DROP')return c.source==='VERIFIED_DROP'?'COLLAB_DROP':null;
 if(summary?.status!=='AVAILABLE')return null;
 return c.tier??null;
}
export function confirmedEdition(summary?:HypeSummary|null):string|null {
 const c=summary?.fashionCard,e=c?.edition;
 if(c?.source!=='VERIFIED_DROP'||!fashionCardLevel(summary)||!e?.confirmed||!Number.isInteger(e.serial)||!Number.isInteger(e.total)||e.serial<1||e.total<e.serial)return null;
 return `#${String(e.serial).padStart(3,'0')}/${e.total}`;
}
export function fashionMetric(value:unknown):number|null{return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?Math.round(value):null;}
