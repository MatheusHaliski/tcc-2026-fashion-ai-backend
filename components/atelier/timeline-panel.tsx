'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {api,mediaUrl} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {useI18n} from '@/lib/i18n/i18n';
import type {AtelierTimeline,AtelierReward} from '@/lib/atelier/types';
import {Button,EmptyState,ErrorState,Select,Skeleton} from '@/components/ui';
import {HolographicFxEngine,ShiftingCardsGrid} from './holographic-fx';
export function TimelinePanel({motion,memories}:{motion:boolean;memories:AtelierReward[]}){
 const {t,fmtDate}=useI18n();const data=useApi<AtelierTimeline>(signal=>api.get('/api/me/photos/timeline',{signal}),[]);const [selected,setSelected]=useState('');const [piece,setPiece]=useState('');
 const photos=useMemo(()=>{const seen=new Set<string>();return [...(data.data?.moments.map(m=>m.photo)??[]),...(data.data?.timeline.flatMap(m=>m.photos)??[])].filter(p=>!seen.has(p.id)&&!!seen.add(p.id)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));},[data.data]);
 const subjects=[...new Map(photos.filter(p=>p.subject).map(p=>[p.subject!.id,p.subject!])).values()];const filtered=piece?photos.filter(p=>p.subject?.id===piece):photos;const active=filtered.find(p=>p.id===selected)??filtered[0];const ordered=active?[active,...filtered.filter(p=>p.id!==active.id)]:filtered;
 if(data.loading)return <Skeleton className="h-64"/>;if(data.error)return <ErrorState error={data.error} onRetry={data.reload}/>;
 return <div className="atelier-timeline"><HolographicFxEngine paused={!motion}/><div className="atelier-section-heading"><div><h2>{t('atelier.timeline.title')}</h2><p>{t('atelier.timeline.hint')}</p></div><label>{t('atelier.timeline.filter')}<Select aria-label={t('atelier.timeline.filter')} value={piece} onChange={e=>{setPiece(e.target.value);setSelected('');}}><option value="">{t('common.all')}</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</Select></label></div>
  {!filtered.length?<EmptyState title={t('atelier.timeline.empty')}/>:<><ol className="atelier-chapter-rail" aria-label={t('atelier.timeline.chapters')}>{filtered.map((photo,i)=><li key={photo.id}><Button size="sm" aria-pressed={active?.id===photo.id} onClick={()=>setSelected(photo.id)}>{i+1} · {fmtDate(photo.createdAt)}</Button></li>)}</ol><ShiftingCardsGrid motion={motion} activeId={active?.id} items={ordered.slice(0,24).map(photo=>({id:photo.id,content:<article className="atelier-memory"><span className="atelier-memory-date">{fmtDate(photo.createdAt)}</span>{(photo.thumbnailUrl||photo.url)&&<img src={mediaUrl(photo.thumbnailUrl??photo.url)} alt={photo.subject?.title??t('atelier.timeline.photo')} loading="lazy"/>}<h3>{photo.subject?.title??t('atelier.timeline.photo')}</h3>{photo.keyMoment&&<p>{t('atelier.timeline.keyMoment')}</p>}{photo.subject&&<Link className="btn btn-sm" href={`/${photo.subject.kind==='PIECE'?'pieces':'schemes'}/${photo.subject.id}`}>{t('atelier.timeline.open')}</Link>}</article>}))}/></>}
  {!!memories.length&&<section className="atelier-earned-memories"><h3>{t('atelier.timeline.earned')}</h3>{memories.map(memory=><article key={memory.id}><h4>{memory.title}</h4><p>{memory.description}</p><small>{fmtDate(memory.earnedAt)} · {memory.sourceType}</small></article>)}</section>}
 </div>;
}
