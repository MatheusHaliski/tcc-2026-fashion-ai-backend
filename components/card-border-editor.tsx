"use client";
import { useI18n } from '@/lib/i18n/i18n';
import { Field,Input,SegmentPicker } from '@/components/ui';
import type { CardBorderConfig } from '@/lib/card-border';
export function CardBorderEditor({value,onChange}:{value?:CardBorderConfig|null;onChange:(border:CardBorderConfig)=>void}) {
 const {t}=useI18n();const config=value??{};
 const set=(patch:Partial<CardBorderConfig>)=>onChange({...config,...patch});
 return <fieldset className="grid gap-3"><legend className="type-h3">{t('cardBorder.title')}</legend><p className="type-caption text-muted">{t('cardBorder.hint')}</p>
 <SegmentPicker label={t('cardBorder.mode')} value={config.mode??'AUTO'} onChange={mode=>set({mode:mode as CardBorderConfig['mode']})} options={['AUTO','COLOR','GRADIENT'].map(id=>({id,label:t(`cardBorder.${id}`)}))}/>
 {config.mode==='COLOR'&&<Field label={t('cardBorder.color')} id="border-color"><Input id="border-color" type="color" value={config.color??'#c6b8a4'} onChange={event=>set({color:event.target.value})}/></Field>}
 {config.mode==='GRADIENT'&&<div className="grid grid-cols-2 gap-3">{(['from','to'] as const).map(key=><Field key={key} label={t(`cardBorder.${key}`)} id={`border-${key}`}><Input id={`border-${key}`} type="color" value={config[key]??(key==='from'?'#65eddf':'#b5a6ff')} onChange={event=>set({[key]:event.target.value})}/></Field>)}</div>}
 <SegmentPicker label={t('cardBorder.effect')} value={config.effect??'AUTO'} onChange={effect=>set({effect:effect as CardBorderConfig['effect']})} options={['AUTO','NONE','GLOW','SHIMMER','HOLO'].map(id=>({id,label:t(`cardBorder.${id}`)}))}/>
 </fieldset>;
}
