'use client';
import {useState} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {useRouter,useSearchParams} from 'next/navigation';
import {api} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {useI18n} from '@/lib/i18n/i18n';
import {ATELIER_CATEGORIES,type AtelierRewardSystem,type AtelierTab} from '@/lib/atelier/types';
import {Button,Dialog,ErrorState,Skeleton,Tabs} from '@/components/ui';
import {ProfileLevelChip} from '@/components/profile-level-progress';
import {HolographicFxEngine,useHologramMotion} from './holographic-fx';
const Metamorphoses=dynamic(()=>import('./metamorphoses-panel').then(m=>m.MetamorphosesPanel),{loading:()=> <Skeleton className="h-64"/>});
const Timeline=dynamic(()=>import('./timeline-panel').then(m=>m.TimelinePanel),{loading:()=> <Skeleton className="h-64"/>});
const Trends=dynamic(()=>import('./trends-panel').then(m=>m.TrendsPanel),{loading:()=> <Skeleton className="h-64"/>});
const Room=dynamic(()=>import('./room-panel').then(m=>m.AtelierRoomPanel),{loading:()=> <Skeleton className="h-64"/>});
const TABS:AtelierTab[]=['metamorphoses','timeline','trends','room'];
export function AtelierHub(){
 const {t}=useI18n();const router=useRouter();const params=useSearchParams();const requested=params.get('tab');const tab=TABS.includes(requested as AtelierTab)?requested as AtelierTab:'metamorphoses';
 const query=useApi<AtelierRewardSystem>(signal=>api.get('/api/me/atelier',{signal}),[]);const [paused,setPaused]=useState(false);const [help,setHelp]=useState(false);const motion=useHologramMotion(paused);
 function navigate(value:AtelierTab){const next=new URLSearchParams(params.toString());next.set('tab',value);router.replace(`/atelier?${next}`,{scroll:false});}
 return <div className="atelier-hub" data-motion={motion?'on':'off'}>
  <header className="atelier-hero"><HolographicFxEngine paused={!motion}/><div className="atelier-hero-content"><p className="atelier-eyebrow">{t('atelier.identityEyebrow')}</p><h1>{t('atelier.brandTitle')}</h1><p>{t('atelier.lead')}</p><div className="atelier-hero-actions"><Button onClick={()=>setHelp(true)}>{t('atelier.help')}</Button><Button aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{t(paused?'atelier.resume':'atelier.pause')}</Button><Link href="/room" className="btn">{t('atelier.visitRoom')}</Link></div></div>{query.data&&<div className="atelier-level"><ProfileLevelChip progress={query.data.levelProgress}/></div>}</header>
  {query.error&&<ErrorState error={query.error} onRetry={query.reload}/>}
  {query.loading?<Skeleton className="h-24"/>:<dl className="atelier-reward-strip" aria-label={t('atelier.rewards')}>{ATELIER_CATEGORIES.map((category,i)=><div key={category}><dt><span aria-hidden="true">{['✧','◷','◇','⌘','⬡','✦'][i]}</span>{t(`atelier.category.${category}`)}</dt><dd>{query.data?query.data.categories[category]?.length??0:'—'}</dd></div>)}</dl>}
  <Tabs tabs={TABS.map(id=>({id,label:t(`atelier.tab.${id}`)}))} value={tab} onChange={navigate} label={t('atelier.tabs')}/>
  <section className="atelier-panel" aria-label={t(`atelier.tab.${tab}`)}>
   {tab==='metamorphoses'?<Metamorphoses/>:tab==='timeline'?<Timeline motion={motion} memories={query.data?.categories.garmentMemory??[]}/>:tab==='trends'?<Trends motion={motion}/>:<Room rewards={query.data??undefined}/>}
  </section>
  <Dialog open={help} onClose={()=>setHelp(false)} title={t('atelier.help')} size="lg"><div className="atelier-help-steps">{TABS.map((id,i)=><article key={id}><span className="atelier-step-number" aria-hidden="true">0{i+1}</span><h2 className="type-h3">{t(`atelier.tab.${id}`)}</h2><p>{t(`atelier.help.${id}`)}</p></article>)}</div><p className="mt-4 type-body-sm">{t('atelier.rewardRules')}</p></Dialog>
 </div>;
}
