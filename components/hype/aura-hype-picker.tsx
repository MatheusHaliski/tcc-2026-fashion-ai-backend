'use client';
import {useState, type CSSProperties} from 'react';
import {Dialog,Button} from '@/components/ui';
import {useI18n} from '@/lib/i18n/i18n';
import {HYPE_PRESETS,hypePreset} from '@/lib/hype/aura-hype-presets';
import {AURA_HYPE_CARD_LEVELS} from '@/lib/hype/fashion-card';
import type {AuraHypeCardLevel} from '@/lib/hype/types';
import {FashionCardHeader,FashionCardStats} from './fashion-card-panel';
export function AuraHypePicker({value,onChange,inline=false}:{value?:string|null;onChange:(mode:string)=>void;inline?:boolean}){
 const {t}=useI18n();const [open,setOpen]=useState(false);const [level,setLevel]=useState<AuraHypeCardLevel>('RARE');
 const selected=value&&value!=='OFF'?hypePreset(value):null;
 const content=<><h3 className="type-h3">{t('fashionHype.levels')}</h3><p className="type-body-sm">{t('fashionHype.previewHint')}</p><div className="fashion-hype-level-previews">{AURA_HYPE_CARD_LEVELS.map(tier=><button type="button" key={tier} className="fashion-hype-level-preview" aria-pressed={level===tier} onClick={()=>setLevel(tier)}><FashionCardHeader state={{kind:'not_calculated'}} previewTier={tier}/><span className="fashion-hype-level-art" /></button>)}</div><p className="type-body">{t('auraHype.photoTechnology')}</p><Button variant="ghost" onClick={()=>onChange('OFF')}>{t('auraHype.OFF')}</Button><div className="aura-hype-preset-grid">{HYPE_PRESETS.map(p=><button type="button" className="aura-hype-preset" key={p.id} aria-pressed={selected?.id===p.id} onClick={()=>{onChange(p.id);setOpen(false);}} style={{'--hype-ink':p.color,'--hype-secondary':p.secondary} as CSSProperties}><FashionCardHeader state={{kind:'not_calculated'}} previewTier={level}/><span className="aura-hype-preset-art" aria-hidden="true" /><FashionCardStats/><span className="opt-name">{t(`auraHype.tech.${p.tech}`)} · {t(`auraHype.palette.${p.palette}`)}</span></button>)}</div></>;
 if(inline)return <div className="grid gap-3">{content}</div>;
 return <div className="opt-group"><p className="label">{t('auraHype.title')}</p><p className="type-caption text-muted">{t('auraHype.hint')}</p><div className="flex flex-wrap gap-3"><Button onClick={()=>setOpen(true)}>{t('auraHype.explore40')}</Button><Button variant="ghost" onClick={()=>onChange('OFF')}>{t('auraHype.OFF')}</Button>{selected&&<span className="type-caption">{t(`auraHype.tech.${selected.tech}`)} · {t(`auraHype.palette.${selected.palette}`)}</span>}</div><Dialog open={open} onClose={()=>setOpen(false)} title={t('auraHype.explore40')} size="xl">{content}</Dialog></div>;
}
