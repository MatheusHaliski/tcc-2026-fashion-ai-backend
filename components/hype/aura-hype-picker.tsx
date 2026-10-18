'use client';
import {useState, type CSSProperties} from 'react';
import {Dialog,Button} from '@/components/ui';
import {useI18n} from '@/lib/i18n/i18n';
import {api} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {HYPE_PRESETS,hypePreset} from '@/lib/hype/aura-hype-presets';
import {AURA_HYPE_CARD_LEVELS} from '@/lib/hype/fashion-card';
import {CARD_LEVEL_TIER,cardLevelUnlocked,type RoomTier} from '@/lib/fashion-card/aura-gating';
import type {AuraHypeCardLevel,HypeDimension} from '@/lib/hype/types';
import {FashionCardHeader,FashionCardStats} from './fashion-card-panel';
import {AuraHype} from './aura-hype';

/** Peça padrão FAI usada só na prévia: a carta é mostrada como fica de verdade, com uma roupa dentro. */
const SAMPLE_PIECE='/_derived/pecas_thumb/02_shirt_camisa-640.webp';
/** Valores de exemplo por nível (marcados como exemplo): mostram a cor de cada faixa sem fingir que são da peça. */
const SAMPLE:Record<AuraHypeCardLevel,Partial<Record<HypeDimension,number>>>={
 COMMON:{POPULARITY:34,ENGAGEMENT:28,TREND:41,TREND_VELOCITY:22,ORIGINALITY:46,RARITY:18,LONGEVITY:39,NOVELTY:31},
 RARE:{POPULARITY:58,ENGAGEMENT:64,TREND:71,TREND_VELOCITY:49,ORIGINALITY:62,RARITY:55,LONGEVITY:47,NOVELTY:68},
 LEGENDARY:{POPULARITY:84,ENGAGEMENT:79,TREND:88,TREND_VELOCITY:73,ORIGINALITY:91,RARITY:86,LONGEVITY:77,NOVELTY:82},
 COLLAB_DROP:{POPULARITY:93,ENGAGEMENT:88,TREND:95,TREND_VELOCITY:90,ORIGINALITY:87,RARITY:98,LONGEVITY:85,NOVELTY:92},
};

export function AuraHypePicker({value,onChange,inline=false}:{value?:string|null;onChange:(mode:string)=>void;inline?:boolean}){
 const {t}=useI18n();const [open,setOpen]=useState(false);const [level,setLevel]=useState<AuraHypeCardLevel>('COMMON');
 const perms=useApi<{currentTier:RoomTier}>(signal=>api.get('/api/me/aura-permissions',{signal}),[]);
 const current=perms.data?.currentTier;
 const selected=value&&value!=='OFF'?hypePreset(value):null;
 const levels=<div className="fashion-hype-level-previews">{AURA_HYPE_CARD_LEVELS.map(tier=>{const unlocked=cardLevelUnlocked(tier,current);
  return <button type="button" key={tier} className="fashion-hype-level-preview is-fashion-hype" data-fashion-level={tier} data-locked={unlocked?undefined:'true'} aria-pressed={level===tier} disabled={!unlocked}
   title={unlocked?undefined:t('auraGate.requires',{level:t(`levelProgress.name.${CARD_LEVEL_TIER[tier]}`)})} onClick={()=>setLevel(tier)}>
   <FashionCardHeader state={{kind:'not_calculated'}} previewTier={tier}/>
   <span className="fashion-hype-level-art"><img src={SAMPLE_PIECE} alt="" loading="lazy"/></span>
   {!unlocked&&<span className="fashion-hype-level-lock"><span aria-hidden>🔒</span>{t('auraGate.requires',{level:t(`levelProgress.name.${CARD_LEVEL_TIER[tier]}`)})}</span>}
  </button>;})}</div>;
 const content=<><h3 className="type-h3">{t('fashionHype.levels')}</h3><p className="type-body-sm">{t('fashionHype.previewHint')}</p>{levels}
  <p className="type-body">{t('auraHype.photoTechnology')}</p><p className="type-caption text-muted">{t('fashionHype.sampleHint')}</p>
  <Button variant="ghost" onClick={()=>onChange('OFF')}>{t('auraHype.OFF')}</Button>
  <div className="aura-hype-preset-grid">{HYPE_PRESETS.map(p=><button type="button" className="aura-hype-preset" key={p.id} aria-pressed={selected?.id===p.id} onClick={()=>{onChange(p.id);setOpen(false);}} style={{'--hype-ink':p.color,'--hype-secondary':p.secondary} as CSSProperties}>
   {/* retrato fiel do modelo: cabeçalho do nível, foto com o efeito animado e a lista de atributos na forma desta técnica */}
   <span className="aura-hype-preset-card is-fashion-hype" data-fashion-level={level}>
    <FashionCardHeader state={{kind:'not_calculated'}} previewTier={level}/>
    <span className="aura-hype-preset-art" aria-hidden="true"><img src={SAMPLE_PIECE} alt="" loading="lazy"/><AuraHype state={{kind:'not_calculated'}} mode={p.id} preview previewTier={level} showScore={false}/></span>
    <FashionCardStats sample={SAMPLE[level]} layout={p.layout}/>
   </span>
   <span className="opt-name">{t(`auraHype.tech.${p.tech}`)} · {t(`auraHype.palette.${p.palette}`)}</span>
  </button>)}</div></>;
 if(inline)return <div className="grid gap-3">{content}</div>;
 return <div className="opt-group"><p className="label">{t('auraHype.title')}</p><p className="type-caption text-muted">{t('auraHype.hint')}</p><div className="flex flex-wrap gap-3"><Button onClick={()=>setOpen(true)}>{t('auraHype.explore40')}</Button><Button variant="ghost" onClick={()=>onChange('OFF')}>{t('auraHype.OFF')}</Button>{selected&&<span className="type-caption">{t(`auraHype.tech.${selected.tech}`)} · {t(`auraHype.palette.${selected.palette}`)}</span>}</div><Dialog open={open} onClose={()=>setOpen(false)} title={t('auraHype.explore40')} size="xl">{content}</Dialog></div>;
}
