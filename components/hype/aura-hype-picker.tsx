'use client';
import {useState} from 'react';
import {Dialog,Button} from '@/components/ui';
import {useI18n} from '@/lib/i18n/i18n';
import {HYPE_PRESETS,hypePreset} from '@/lib/hype/aura-hype-presets';
import {AURA_HYPE_CARD_LEVELS} from '@/lib/hype/fashion-card';
import type {AuraHypeCardLevel} from '@/lib/hype/types';
import {FashionCardHeader} from './fashion-card-panel';
import {AuraHype} from './aura-hype';
export function AuraHypePicker({value,onChange}:{value?:string|null;onChange:(mode:string)=>void}){
 const {t}=useI18n();const [open,setOpen]=useState(false);const [level,setLevel]=useState<AuraHypeCardLevel>('RARE');
 const selected=value&&value!=='OFF'?hypePreset(value):null;
 return <div className="opt-group"><p className="label">{t('auraHype.title')}</p><p className="type-caption text-muted">{t('auraHype.hint')}</p><div className="flex flex-wrap gap-3"><Button onClick={()=>setOpen(true)}>{t('auraHype.explore40')}</Button><Button variant="ghost" onClick={()=>onChange('OFF')}>{t('auraHype.OFF')}</Button>{selected&&<span className="type-caption">{t(`auraHype.tech.${selected.tech}`)} · {t(`auraHype.palette.${selected.palette}`)}</span>}</div>
 <Dialog open={open} onClose={()=>setOpen(false)} title={t('auraHype.explore40')} size="xl"><h3 className="type-h3">{t('fashionHype.levels')}</h3><p className="type-body-sm">{t('fashionHype.previewHint')}</p><div className="fashion-hype-level-previews">{AURA_HYPE_CARD_LEVELS.map(tier=><button type="button" key={tier} className="fashion-hype-level-preview" aria-pressed={level===tier} onClick={()=>setLevel(tier)}><FashionCardHeader state={{kind:'not_calculated'}} previewTier={tier}/><span className="fashion-hype-level-art"><AuraHype preview previewTier={tier} mode={value??undefined} state={{kind:'not_calculated'}} showScore={false}/></span></button>)}</div><p className="type-body">{t('auraHype.photoTechnology')}</p><div className="opt-grid">{HYPE_PRESETS.map(p=><button type="button" className="opt-tile" key={p.id} aria-pressed={selected?.id===p.id} onClick={()=>{onChange(p.id);setOpen(false);}}><span className="opt-thumb relative overflow-hidden" style={{background:'linear-gradient(145deg,#1e2934,#343139)'}}><AuraHype mode={p.id} preview previewTier={level} state={{kind:'not_calculated'}}/></span><span className="opt-name">{t(`auraHype.tech.${p.tech}`)} · {t(`auraHype.palette.${p.palette}`)}</span></button>)}</div></Dialog></div>;
}
