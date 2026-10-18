'use client';
import type {HypeSummary,AuraHypeCardLevel,HypeEntity,HypeDimension} from '@/lib/hype/types';
import type {HypeLayout} from '@/lib/hype/aura-hype-presets';
import type {HypeViewState} from '@/lib/hype/model';
import {dimensionsFor,displayScore} from '@/lib/hype/model';
import {fashionCardLevel,confirmedEdition,fashionMetric} from '@/lib/hype/fashion-card';
import {useI18n} from '@/lib/i18n/i18n';
import {LedNumber} from '@/components/led-number';

export function FashionCardHeader({summary,state,previewTier}:{summary?:HypeSummary|null;state:HypeViewState;previewTier?:AuraHypeCardLevel}){
 const {t}=useI18n();const tier=previewTier??fashionCardLevel(summary);
 return <span className="fashion-hype-header"><span className="fashion-hype-rarity" title={t('fashionHype.digitalLevel')}>{t(tier?`fashionHype.level.${tier}`:'fashionHype.pending')}</span><span className="fashion-hype-header-score"><small>{t('fashionHype.scoreLabel')}</small>{state.kind==='available'?<><span className="sr-only">{displayScore(state.score)}</span><span aria-hidden><LedNumber value={displayScore(state.score)}/></span>{state.stale&&<span title={t('auraHype.stale')}>↻</span>}</>:<span>—</span>}</span></span>;
}
/** Faixa do número na matriz: a cor diz se o atributo é forte, médio ou fraco (sem valor = sem cor). */
const tone=(v:number|null)=>v===null?undefined:v>=70?'high':v>=40?'mid':'low';
/**
 * Atributos do Hype em matriz de números, como numa carta: os mesmos derivados que o verso mostra (8 da peça, 9 do look),
 * sigla curta embaixo e nome completo no title/leitor de tela. Sem dado calculado, "—"; nada é estimado.
 */
export function FashionCardStats({summary,styles=[],name,type='PIECE',layout='grid',sample}:{summary?:HypeSummary|null;styles?:string[];name?:string;type?:HypeEntity;layout?:HypeLayout;
 /** só na prévia dos modelos: valores de exemplo, marcados como exemplo; nunca no card de uma peça */
 sample?:Partial<Record<HypeDimension,number>>}){
 const {t}=useI18n();const edition=confirmedEdition(summary);const available=summary?.status==='AVAILABLE';
 return <span className="fashion-hype-metadata">
  {name&&<strong className="fashion-hype-piece-name">{name}</strong>}
  {edition&&<span className="fashion-hype-edition">{edition} · {t('fashionHype.limitedEdition')}</span>}
  {!!styles.length&&<span className="fashion-hype-tags">{styles.slice(0,3).map(style=><span key={style}>{style}</span>)}</span>}
  <dl className="fashion-hype-matrix" data-layout={layout} data-sample={sample?'true':undefined} aria-label={sample?`${t('fashionHype.attributes')} · ${t('fashionHype.sample')}`:t('fashionHype.attributes')}>{dimensionsFor(type).map(d=>{const v=sample?fashionMetric(sample[d]):available?fashionMetric(summary?.dimensions?.[d]):null;const full=t(`hype.dimension.${d}`);
   return <div key={d} className="fashion-hype-cell" data-tone={tone(v)} data-dimension={d} title={`${full}: ${v??t('fashionHype.unavailable')}`}><dt><abbr title={full}>{t(`fashionHype.short.${d}`)}</abbr></dt><dd>{v??'—'}</dd></div>;})}</dl>
 </span>;
}
