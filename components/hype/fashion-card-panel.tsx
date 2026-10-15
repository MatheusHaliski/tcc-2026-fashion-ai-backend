'use client';
import type {HypeSummary,AuraHypeCardLevel} from '@/lib/hype/types';
import type {HypeViewState} from '@/lib/hype/model';
import {displayScore} from '@/lib/hype/model';
import {fashionCardLevel,confirmedEdition,fashionMetric} from '@/lib/hype/fashion-card';
import {useI18n} from '@/lib/i18n/i18n';
import {LedNumber} from '@/components/led-number';

export function FashionCardHeader({summary,state,previewTier}:{summary?:HypeSummary|null;state:HypeViewState;previewTier?:AuraHypeCardLevel}){
 const {t}=useI18n();const tier=previewTier??fashionCardLevel(summary);
 return <span className="fashion-hype-header"><span className="fashion-hype-rarity" title={t('fashionHype.digitalLevel')}>{t(tier?`fashionHype.level.${tier}`:'fashionHype.pending')}</span><span className="fashion-hype-header-score"><small>{t('fashionHype.scoreLabel')}</small>{state.kind==='available'?<><span className="sr-only">{displayScore(state.score)}</span><span aria-hidden><LedNumber value={displayScore(state.score)}/></span>{state.stale&&<span title={t('auraHype.stale')}>↻</span>}</>:<span>—</span>}</span></span>;
}
export function FashionCardStats({summary,styles=[],name}:{summary?:HypeSummary|null;styles?:string[];name?:string}){
 const {t}=useI18n();const edition=confirmedEdition(summary);const legacy=summary?.status==='AVAILABLE'?fashionMetric(summary.dimensions?.LONGEVITY):null;
 return <span className="fashion-hype-metadata">
  {name&&<strong className="fashion-hype-piece-name">{name}</strong>}
  {edition&&<span className="fashion-hype-edition">{edition} · {t('fashionHype.limitedEdition')}</span>}
  {!!styles.length&&<span className="fashion-hype-tags">{styles.slice(0,3).map(style=><span key={style}>{style}</span>)}</span>}
  <span className="fashion-hype-stat"><span>{t('fashionHype.versatility')}</span><span className="fashion-hype-meter" title={t('fashionHype.unavailable')}><i style={{width:0}}/></span><b title={t('fashionHype.unavailable')}>—</b></span>
  <span className="fashion-hype-stat"><span>{t('fashionHype.legacy')}</span><span className="fashion-hype-meter" role={legacy===null?undefined:'meter'} aria-label={t('fashionHype.legacy')} aria-valuemin={legacy===null?undefined:0} aria-valuemax={legacy===null?undefined:100} aria-valuenow={legacy??undefined}><i style={{width:`${legacy??0}%`}}/></span><b>{legacy===null?'—':`${legacy}%`}</b></span>
 </span>;
}
