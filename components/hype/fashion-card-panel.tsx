'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {rankedDimensions,dimensionDelta,keyDimensions,type HypeEditorialContext} from '@/lib/hype/layout-data';
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
/** Fixed layouts and animated editorial views share the same server dimensions. */
export function FashionCardStats({summary,styles=[],name,type='PIECE',layout='grid',sample,context={}}:{summary?:HypeSummary|null;styles?:string[];name?:string;type?:HypeEntity;layout?:HypeLayout;sample?:Partial<Record<HypeDimension,number>>;context?:HypeEditorialContext}){
 const {t}=useI18n();const edition=confirmedEdition(summary);
 const data: HypeSummary|undefined|null=sample?{status:'AVAILABLE',score:72,dimensions:sample}:summary;
 const [previous,setPrevious]=useState<HypeSummary|null>(null);const latest=useRef<HypeSummary|null>(null);
 useEffect(()=>{const old=latest.current;if(summary?.calculatedAt&&old?.calculatedAt&&Date.parse(summary.calculatedAt)>Date.parse(old.calculatedAt))setPrevious(old);if(summary)latest.current=summary;},[summary]);
 const ranked=rankedDimensions(data,type);const valid=ranked.filter(row=>row.value!==null);
 let rows=dimensionsFor(type).map(dimension=>({dimension,value:data?.status==='AVAILABLE'?fashionMetric(data.dimensions?.[dimension]):null,reason:''}));
 if(layout==='ranked-bars')rows=ranked.map(row=>({...row,reason:''}));
 if(layout==='extremes')rows=(valid.length>1?[valid[0],valid[valid.length-1]]:valid).map(row=>({...row,reason:''}));
 if(layout==='momentum')rows=valid.slice(0,1).map(row=>({...row,reason:''}));
 if(layout==='key-triad')rows=keyDimensions(data,type,context);
 const list=useRef<HTMLDListElement>(null);const positions=useRef(new Map<string,number>());
 useLayoutEffect(()=>{const next=new Map<string,number>();for(const node of list.current?.querySelectorAll<HTMLElement>('[data-dimension]')??[]){const key=node.dataset.dimension!,y=node.getBoundingClientRect().top;next.set(key,y);const before=positions.current.get(key);if(layout==='ranked-bars'&&before!==undefined&&before!==y&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)node.animate?.([{transform:`translateY(${before-y}px)`},{transform:'translateY(0)'}],{duration:400,easing:'ease-out'});}positions.current=next;},[data,layout]);
 return <span className="fashion-hype-metadata" data-hype-layout={layout}>
  {name&&<strong className="fashion-hype-piece-name">{name}</strong>}
  {edition&&<span className="fashion-hype-edition">{edition} · {t('fashionHype.limitedEdition')}</span>}
  {!!styles.length&&<span className="fashion-hype-tags">{styles.slice(0,3).map(style=><span key={style}>{style}</span>)}</span>}
  {sample&&<small>{t('fashionHype.sample')}</small>}
  {layout==='static-global'?<span className="hype-global-only"><small>{t('fashionHype.scoreLabel')}</small><strong>{data?.status==='AVAILABLE'&&fashionMetric(data.score)!==null?Math.round(data.score!):'—'}</strong></span>:<>
   {['extremes','momentum'].includes(layout)&&<small>{t('hypeLayout.currentRanking')}</small>}
   <dl ref={list} className="fashion-hype-matrix" data-layout={layout} data-sample={sample?'true':undefined} aria-label={t('fashionHype.attributes')}>
    {rows.map(({dimension:d,value:v,reason},i)=>{const full=t(`hype.dimension.${d}`),delta=dimensionDelta(summary,previous,d);return <div key={d} className="fashion-hype-cell" data-dimension={d} data-tone={layout==='extremes'?(i===0?'max':'min'):v===null?undefined:v>=70?'high':v>=40?'mid':'low'} title={`${full}: ${v??t('fashionHype.unavailable')}`}>
     <dt>{layout==='momentum'?t('hypeLayout.opinion',{attribute:full}):<abbr title={full}>{t(`fashionHype.short.${d}`)}</abbr>}</dt>
     <dd>{layout==='extremes'&&<span aria-label={t(i===0?'hypeLayout.maximum':'hypeLayout.minimum')}>{i===0?'↑':'↓'} </span>}{v??'—'}{layout==='key-triad'&&<span className="hype-mini-stars" aria-hidden> ✦✧✦</span>}</dd>
     {layout==='ranked-bars'&&<span className="hype-led-track" aria-hidden><i style={{width:`${v??0}%`}}/></span>}
     {['extremes','momentum'].includes(layout)&&<small className="hype-dimension-trend">{delta===null?t('hypeLayout.noHistory'):t('hypeLayout.delta',{arrow:delta>0?'↑':delta<0?'↓':'→',value:Math.abs(delta)})}</small>}
     {layout==='key-triad'&&<small>{t(`hypeLayout.reason.${reason}`)}</small>}
    </div>;})}
   </dl>
   {!rows.length&&<span>{t('fashionHype.unavailable')}</span>}
   {layout==='key-triad'&&<small>{t('hypeLayout.editorialHint')}</small>}
  </>}
  {summary?.stale&&<small>{t('auraHype.stale')}</small>}
 </span>;
}
