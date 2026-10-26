'use client';
/*
 * FLAIR Metamorfose — MET Gala Heist v2: escolher um look (deck) e jogar em tela cheia. Antes de entrar, cada peça mostra
 * no que vira na partida (vestir, Visão, grampo, munição, faca, cronômetro, curativo…) e quanto vale para o revendedor —
 * a decisão de trocar ou usar começa aqui. Liberado no mesmo nível dos outros jogos Metamorfose (Loft).
 */
import {useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {api} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {hasReachedLevel,levelNameKey,type PointsAccount} from '@/lib/points/hub';
import {useI18n} from '@/lib/i18n/i18n';
import {Button,EmptyState,ErrorState,PageHeader,Skeleton,cn} from '@/components/ui';
import {useWebGL} from '@/components/three/common';
import {matchCards,toHeistCard,type DeckCard} from '@/lib/heist/cards';
import type {FlairDeck} from './flair-card';

const HeistGame=dynamic(()=>import('@/components/heist/game').then(m=>m.HeistGame),{ssr:false,loading:()=> <Skeleton className="h-full"/>});

export function GalaHeist(){
 const {t}=useI18n();const webgl=useWebGL();
 const points=useApi<PointsAccount>(signal=>api.get('/api/me/points',{signal}),[]);
 const unlocked=hasReachedLevel(points.data?.level,'LOFT');
 const decks=useApi<FlairDeck[]>(signal=>api.get('/api/flair/decks',{signal}),[],{enabled:unlocked});
 const [picked,setPicked]=useState<string|null>(null);const [playing,setPlaying]=useState(false);
 const deck=decks.data?.find(d=>d.schemeId===picked)??decks.data?.[0]??null;
 const cards=useMemo(()=>deck?matchCards(deck.cards as DeckCard[]):[],[deck]);
 if(points.error)return <ErrorState error={points.error} onRetry={points.reload}/>;
 if(points.loading||!points.data)return <Skeleton className="h-64"/>;
 if(!unlocked)return <><PageHeader title={t('galaHeist.title')} lead={t('galaHeist.lead')}/><section className="surface p-4" role="status"><p className="type-body">{t('afterparty.locked',{level:t(levelNameKey('LOFT'))})}</p><Link href="/points" className="btn btn-primary mt-3">{t('flair.xp.viewProgress')}</Link></section></>;
 if(playing&&deck)return <div className="gala-heist-stage" role="application" aria-label={t('galaHeist.title')}><HeistGame cards={cards} onExit={()=>setPlaying(false)}/></div>;
 return <><PageHeader title={t('galaHeist.title')} lead={t('galaHeist.lead')} actions={<Link href="/flair/partidas" className="btn btn-sm">{t('flair.modes.category.metamorphose')}</Link>}/>
  {decks.error?<ErrorState error={decks.error} onRetry={decks.reload}/>:decks.loading?<Skeleton className="h-64"/>:!decks.data?.length?<EmptyState title={t('galaHeist.noDeck')} action={<Link className="btn" href="/schemes/new">{t('common.criar_esquema')}</Link>}/>:<section className="surface p-4 grid gap-4">
   <fieldset className="grid gap-2"><legend className="type-h3 mb-1">{t('galaHeist.choose')}</legend>
    <div className="gala-heist-decks">{decks.data.map(d=><label key={d.schemeId} className={cn('surface p-3 gala-heist-deck',deck?.schemeId===d.schemeId&&'is-on')}><input type="radio" name="gala-deck" checked={deck?.schemeId===d.schemeId} onChange={()=>setPicked(d.schemeId)}/> <strong>{d.title}</strong> <span className="text-muted">· {t('galaHeist.pieces',{n:d.cards.length})}</span></label>)}</div>
   </fieldset>
   {deck&&<div><h3 className="type-h3">{t('galaHeist.inGame')}</h3><p className="type-body-sm text-muted">{t('galaHeist.inGameLead')}</p>
    <ul className="gala-heist-cards">{(deck.cards as DeckCard[]).map(c=>{const h=toHeistCard(c);const used=cards.some(x=>x.id===c.id);return <li key={c.id} className={cn(!used&&'is-out')}><strong>{c.name}</strong><span>{t(`heist.tier.${h.tier}`)} · {t('heist.vendor.value',{n:h.value})}</span><span className="text-muted">{t(`heist.use.${h.use}.short`)}</span>{!used&&<span className="type-caption">{t('galaHeist.outOfDeck')}</span>}</li>;})}</ul>
    {cards.some(c=>c.starter)&&<p className="type-caption mt-2">{t('galaHeist.starterNote')}</p>}
   </div>}
   {webgl===false?<p role="alert" className="type-body">{t('galaHeist.noWebgl')}</p>:<Button variant="primary" disabled={!deck||webgl===null} onClick={()=>setPlaying(true)}>{t('galaHeist.play')}</Button>}
   <p className="type-caption text-muted">{t('galaHeist.controlsNote')}</p>
  </section>}
 </>;
}
