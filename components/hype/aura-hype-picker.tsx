'use client';
import {useState} from 'react';
import {Dialog,Button} from '@/components/ui';
import {useI18n} from '@/lib/i18n/i18n';
import {HYPE_PRESETS,hypePreset} from '@/lib/hype/aura-hype-presets';
import {AuraHype} from './aura-hype';
export function AuraHypePicker({value,onChange}:{value?:string|null;onChange:(mode:string)=>void}){
 const {t}=useI18n();const [open,setOpen]=useState(false);
 const selected=value&&value!=='OFF'?hypePreset(value):null;
 return <div className="opt-group"><p className="label">{t('auraHype.title')}</p><p className="type-caption text-muted">{t('auraHype.hint')}</p><div className="flex flex-wrap gap-3"><Button onClick={()=>setOpen(true)}>{t('auraHype.explore40')}</Button><Button variant="ghost" onClick={()=>onChange('OFF')}>{t('auraHype.OFF')}</Button>{selected&&<span className="type-caption">{t(`auraHype.tech.${selected.tech}`)} · {t(`auraHype.palette.${selected.palette}`)}</span>}</div>
 <Dialog open={open} onClose={()=>setOpen(false)} title={t('auraHype.explore40')} size="xl"><p className="type-body">{t('auraHype.photoTechnology')}</p><div className="opt-grid">{HYPE_PRESETS.map(p=><button type="button" className="opt-tile" key={p.id} aria-pressed={selected?.id===p.id} onClick={()=>{onChange(p.id);setOpen(false);}}><span className="opt-thumb relative overflow-hidden" style={{background:'linear-gradient(145deg,#1e2934,#343139)'}}><AuraHype mode={p.id} preview state={{kind:'not_calculated'}}/></span><span className="opt-name">{t(`auraHype.tech.${p.tech}`)} · {t(`auraHype.palette.${p.palette}`)}</span></button>)}</div></Dialog></div>;
}
