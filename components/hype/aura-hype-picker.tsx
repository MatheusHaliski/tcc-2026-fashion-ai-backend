'use client';
import {useEffect,useId,useState,type CSSProperties} from 'react';
import {Dialog,Button} from '@/components/ui';
import {FaiIcon} from '@/components/fai-icon';
import {useI18n} from '@/lib/i18n/i18n';
import {api} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {HYPE_PRESETS,hypePreset,hypePresetsForTier,type HypePresetKind} from '@/lib/hype/aura-hype-presets';
import {AURA_HYPE_CARD_LEVELS} from '@/lib/hype/fashion-card';
import {CARD_LEVEL_TIER,cardLevelUnlocked} from '@/lib/fashion-card/aura-gating';
import type {AuraHypeCardLevel,HypeSummary} from '@/lib/hype/types';
import {FashionCardStats} from './fashion-card-panel';
import {AuraHype} from './aura-hype';
const FINISH_ICONS:Record<AuraHypeCardLevel,string>={COMMON:'ACT-26',RARE:'ACT-39',LEGENDARY:'ACT-37',COLLAB_DROP:'SOC-06'};
const SAMPLE_PIECE='/_derived/pecas_thumb/02_shirt_camisa-640.webp';
function ModelDemo({preset}:{preset:typeof HYPE_PRESETS[number]}){
 const [phase,setPhase]=useState(0);const {t}=useI18n();
 useEffect(()=>{if(preset.kind==='static'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;const timer=setInterval(()=>setPhase(p=>1-p),2600);return ()=>clearInterval(timer);},[preset.kind]);
 const summary:HypeSummary={status:'AVAILABLE',score:72,level:'HOT',algorithmVersion:'DEMO',calculatedAt:phase?'2026-01-02T00:00:00Z':'2026-01-01T00:00:00Z',dimensions:{POPULARITY:phase?86:62,ENGAGEMENT:71,TREND:phase?50:82,TREND_VELOCITY:44,ORIGINALITY:67,RARITY:32,LONGEVITY:58,NOVELTY:49}};
 return <span className="aura-hype-preset-card is-fashion-hype" data-finish-tier={preset.tier}>
  <span className="aura-hype-preset-art" aria-hidden><img src={SAMPLE_PIECE} alt="" loading="lazy"/><AuraHype state={{kind:'not_calculated'}} mode={preset.id} preview previewTier={preset.tier} showScore={false}/></span>
  <small className="hype-demo-label">{t('fashionHype.sample')}</small><FashionCardStats summary={summary} layout={preset.layout} context={{style:['classic'],color:'blue',brandName:'FAI Demo'}}/>
 </span>;
}
export function AuraHypePicker({value,onChange,inline=false}:{value?:string|null;onChange:(mode:string)=>void;inline?:boolean}){
 const {t}=useI18n();const id=useId();const [open,setOpen]=useState(false);const selected=value&&value!=='OFF'?hypePreset(value):null;
 const [desiredLevel,setLevel]=useState<AuraHypeCardLevel>(selected?.tier??'COMMON');
 const perms=useApi<{currentTier:string}>(signal=>api.get('/api/me/aura-permissions',{signal}),[],{enabled:inline||open,refreshInterval:30000});
 const currentTier=perms.loading||perms.error?null:perms.data?.currentTier;
 const level=cardLevelUnlocked(desiredLevel,currentTier)?desiredLevel:"COMMON";
 const unlocked=cardLevelUnlocked(level,currentTier);
 const band=(kind:HypePresetKind)=><section className="aura-hype-preset-band" data-preset-kind={kind} aria-labelledby={`${id}-${kind}`}>
  <h4 id={`${id}-${kind}`} className="type-h3">{t(`auraHype.${kind}Title`)}</h4><p className="type-caption">{t(`auraHype.${kind}Hint`)}</p>
  <div className="aura-hype-preset-grid" tabIndex={0} role="group" aria-label={t(`auraHype.${kind}Title`)}>{hypePresetsForTier(level).filter(p=>p.kind===kind).map(p=><button type="button" key={p.id} className="aura-hype-preset" data-preset-kind={kind} disabled={!unlocked} aria-pressed={selected?.id===p.id} onClick={()=>{if(unlocked){onChange(p.id);setOpen(false);}}} style={{'--hype-ink':p.color,'--hype-secondary':p.secondary} as CSSProperties}>
   <ModelDemo preset={p}/><span className="opt-name">{t(`hypeLayout.${p.layout}`)}</span>
  </button>)}</div>
 </section>;
 const content=<><p className="type-body-sm">{t('hypeLayout.finishHint')}</p>
 {perms.loading&&<p role="status">{t('auraGate.checking')}</p>}
 {perms.error&&<div role="alert"><p>{t('auraGate.checkFailed')}</p><Button onClick={perms.reload}>{t('sealHypeIssuer.retry')}</Button></div>}
 <div className="fashion-hype-level-previews">{AURA_HYPE_CARD_LEVELS.map(tier=>{
  const allowed=cardLevelUnlocked(tier,currentTier);
  const requirement=t('auraGate.requires',{level:t(`levelProgress.name.${CARD_LEVEL_TIER[tier]}`)});
  return <button type="button" key={tier} className="fashion-hype-level-preview" data-fashion-level={tier} data-locked={!allowed||undefined} aria-pressed={tier===level} disabled={!allowed} title={`${t(`hypeLayout.finish.${tier}`)}${!allowed?` · ${requirement}`:""}`} aria-label={`${t(`hypeLayout.finish.${tier}`)}${!allowed?` · ${requirement}`:""}`} onClick={()=>{if(allowed)setLevel(tier);}}>
   <span className="fashion-hype-level-name">
    <span className="fashion-hype-level-token" aria-hidden="true"><FaiIcon id={FINISH_ICONS[tier]} size={48} variant="medal" decorative />{tier==='COLLAB_DROP'&&<FaiIcon id="SOC-06" size={24} variant="medal" className="fashion-hype-level-extra-star" decorative />}</span>
    <span className="sr-only">{t(`hypeLayout.finish.${tier}`)}</span>
    {!allowed&&<span className="fashion-hype-level-lock-icon" data-fai-lock><FaiIcon id="ACT-04" size={24} decorative /></span>}
   </span>
   {!allowed&&<small className="fashion-hype-level-requirement">{requirement}</small>}
  </button>;
 })}</div>
 {!unlocked&&<p role="status">{t('auraGate.requires',{level:t(`levelProgress.name.${CARD_LEVEL_TIER[level]}`)})}</p>}
 <Button variant="ghost" onClick={()=>onChange('OFF')}>{t('auraHype.OFF')}</Button>{band('static')}{band('dynamic')}</>;
 if(inline)return <div className="grid gap-3">{content}</div>;
 return <div className="opt-group"><p className="label">{t('auraHype.title')}</p><Button onClick={()=>setOpen(true)}>{t('hypeLayout.explore')}</Button><Dialog open={open} onClose={()=>setOpen(false)} title={t('hypeLayout.explore')} size="xl">{content}</Dialog></div>;
}
