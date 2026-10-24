'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {useI18n} from '@/lib/i18n/i18n';
import {atelierTrendSignals} from '@/lib/atelier/trends';
import {label} from '@/lib/api/taxonomy';
import type {AtelierTrends} from '@/lib/atelier/types';
import {PieceCard} from '@/components/piece-card';
import {Button,EmptyState,ErrorState,Skeleton} from '@/components/ui';
import {DataTunnelPipes,ShiftingCardsGrid} from './holographic-fx';
export function TrendsPanel({motion}:{motion:boolean}){
 const {t}=useI18n();const [version,setVersion]=useState(0);const query=useApi<AtelierTrends>(signal=>api.get('/api/hype/trending?type=PIECE&window=7&limit=18',{signal}),[version]);
 useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)setVersion(v=>v+1);},30000);return()=>clearInterval(timer);},[]);
 const groups=[{id:'style',values:atelierTrendSignals(query.data?.items??[],'style')},{id:'color',values:atelierTrendSignals(query.data?.items??[],'color')}];
 return <div className="atelier-trends"><div className="atelier-section-heading"><div><h2>{t('atelier.trends.title')}</h2><p>{t('atelier.trends.source')}</p></div><Button disabled={query.loading} onClick={()=>setVersion(v=>v+1)}>{t('atelier.trends.refresh')}</Button></div><div className="atelier-trend-matrix"><DataTunnelPipes/>{groups.map(group=><section key={group.id} className="atelier-trend-gauge"><span className="atelier-orbit" aria-hidden="true"/><h3>{t(`atelier.trends.${group.id}`)}</h3><ul>{group.values.slice(0,4).map(({name,count,delta})=><li key={name}><span>{label(name)}</span><meter min={0} max={Math.max(1,query.data?.items.length??0)} value={count} aria-label={label(name)}/><b>{count}</b><small className="atelier-trend-delta" data-direction={delta===null?"unknown":delta>0?"up":delta<0?"down":"stable"}>{delta===null?t("atelier.trends.deltaUnknown"):t("atelier.trends.delta",{value:`${delta>0?"+":""}${delta}`})}</small></li>)}</ul>{!group.values.length&&<p>{t('atelier.trends.noSignals')}</p>}</section>)}</div>
  {query.loading&&!query.data?<Skeleton className="h-64"/>:query.error?<ErrorState error={query.error} onRetry={query.reload}/>:!query.data?.items.length?<EmptyState title={t('atelier.trends.empty')}/>:<ShiftingCardsGrid motion={motion} items={query.data.items.map(row=>({id:row.id,content:<div className="atelier-trending-piece"><p className="atelier-trend-score">#{row.rank} · {t('impersonation.stat.hypeIndex')} {row.hype.status==='AVAILABLE'?row.hype.score:'—'}</p><PieceCard piece={row.piece}/><Link className="btn btn-sm" href={`/pieces/${row.piece.id}`}>{t('atelier.trends.explore')}</Link></div>}))}/>}
 </div>;
}
