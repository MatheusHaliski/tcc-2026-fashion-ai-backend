'use client';
import {cn} from '@/components/ui';
import {useI18n} from '@/lib/i18n/i18n';
import {modEffects,type AdventureMods,type ModEffect} from '@/lib/flair/afterparty';

const MARK={plus:'+',minus:'−',neutral:'·'} as const;
const signed=(p:number)=>p>0?`+${p} %`:p<0?`−${Math.abs(p)} %`:'0 %';

/**
 * "O que o seu deck muda" no MET Gala Heist: o avatar (agilidade, furtividade, carisma, fôlego) e o salão (luz,
 * convidados, rota VIP), cada efeito com sinal de vantagem (+), desvantagem (−) ou neutro (·) — o sinal vem também em
 * texto para leitores de tela. Compacto (durante a partida), mostra só o que muda alguma coisa.
 */
export function HeistMods({mods,compact=false}:{mods:AdventureMods;compact?:boolean}){
 const {t}=useI18n();
 const text=(e:ModEffect)=>{
  if(e.percent!==undefined)return t(`afterparty.mods.${e.key}_effect`,{pct:signed(e.percent)});
  if(e.key==='light')return t(`afterparty.mods.light.${e.value}`);
  if(e.key==='crowd')return t(e.tone==='plus'?'afterparty.mods.crowd_effect':'afterparty.mods.crowd_few',{n:e.value??0});
  return e.tone==='plus'?t('afterparty.mods.vip_open',{s:e.value??0}):t('afterparty.mods.vip_closed');
 };
 const effects=modEffects(mods).filter(e=>!compact||e.tone!=='neutral');
 if(compact&&!effects.length)return null;
 return <section className={cn('heist-mods',compact&&'is-compact')} aria-label={t('afterparty.mods.title')}>
  {!compact&&<div><h3 className="type-h3">{t('afterparty.mods.title')}</h3><p className="type-body-sm text-muted">{t('afterparty.mods.lead')}</p></div>}
  <ul className="heist-mods-list">{effects.map(e=><li key={e.key} className={cn('heist-mod',`is-${e.tone}`)} data-mod={e.key}>
   <span className="heist-mod-mark" aria-hidden>{MARK[e.tone]}</span>
   <span className="heist-mod-body"><strong>{t(`afterparty.mods.${e.key}`)}</strong><span className="sr-only"> ({t(`afterparty.mods.tone.${e.tone}`)})</span>{' '}
    {!compact&&e.score!==undefined&&<meter className="heist-mod-meter" min={0} max={100} value={e.score} aria-label={t('afterparty.mods.score',{name:t(`afterparty.mods.${e.key}`),score:e.score})}/>}
    <span className="heist-mod-text">{text(e)}</span></span>
  </li>)}</ul>
 </section>;
}
