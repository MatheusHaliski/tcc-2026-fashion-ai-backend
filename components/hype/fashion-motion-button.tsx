'use client';
import {useI18n} from '@/lib/i18n/i18n';
export function FashionMotionButton({available,on,error,onToggle}:{available:boolean;on:boolean;error:boolean;onToggle:()=>void}){
 const {t}=useI18n();if(!available)return null;
 return <span className="fashion-motion-control"><button type="button" aria-pressed={on} onClick={onToggle} title={t('fashionHype.motionHint')}>{t(on?'fashionHype.motionOff':'fashionHype.motionOn')}</button>{error&&<span role="status">{t('fashionHype.motionError')}</span>}</span>;
}
