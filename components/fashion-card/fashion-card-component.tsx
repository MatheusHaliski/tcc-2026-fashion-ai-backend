'use client';
import {mediaUrl} from '@/lib/api/client';
import {useEffect,useState,type ReactNode} from 'react';
import type {FashionCard} from '@/lib/fashion-card/types';
import {safeMediaUrl,validStat} from '@/lib/fashion-card/types';
import {AuraGatingConfig,getLockedAuraMessage,type RoomTier,type GatedAuraType} from '@/lib/fashion-card/aura-gating';
import {ArtVideo} from '@/components/card-art';
import {useI18n} from '@/lib/i18n/i18n';
import {LedNumber} from '@/components/led-number';

export interface FashionCardItem {id:string;name:string;imageUrl?:string|null;styles?:string[];fashionCard:FashionCard}
export interface AuraCardAccess {allowed:boolean;requiredTier:RoomTier;loading?:boolean}
function useMotionPreference(){const [reduced,setReduced]=useState(true);useEffect(()=>{const mq=window.matchMedia('(prefers-reduced-motion: reduce)');const read=()=>setReduced(mq.matches||document.documentElement.dataset.reduceMotion==='true');read();mq.addEventListener('change',read);const observer=new MutationObserver(read);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduce-motion']});return()=>{mq.removeEventListener('change',read);observer.disconnect();};},[]);return reduced;}
export function FashionCardComponent({item,access,footer,onGenerate}:{item:FashionCardItem;access?:AuraCardAccess;footer?:ReactNode;onGenerate?:()=>void}){
 const {t}=useI18n();const card=item.fashionCard;const impersonation=card.auraType==='IMPERSONATION';const metamorphose=card.auraType==='METAMORPHOSE';const gated:GatedAuraType=impersonation?'AURA_IMPERSONATION':metamorphose?'AURA_METAMORPHOSE':card.auraType==='COMMON'&&!card.cardMediaUrl?'AURA_BASIC':'AURA_DYNAMIC';
 const locked=access?.loading||!(access?.allowed??gated==='AURA_BASIC');const reduced=useMotionPreference();const [playing,setPlaying]=useState(true);const [mediaError,setMediaError]=useState(false);
 const data=card.impersonationData;const mock=data?.status==='MOCK_PREVIEW';const media=impersonation?data?.renderedCardMediaUrl:card.cardMediaUrl;const poster=impersonation?data?.posterUrl:item.imageUrl;const posterSafe=!!poster&&safeMediaUrl(poster);const animate=!locked&&!reduced&&playing&&!mediaError&&!!media&&safeMediaUrl(media);
 const serial=card.serialNumber?.match(/^#(\d{1,7})\/(\d{1,7})$/);const serialValid=serial&&+serial[1]>0&&+serial[1]<=+serial[2]&&+serial[2]<=1000000&&card.rarity!=='COMMON';
 const stats=[['versatility',card.stats.versatility],['hypeIndex',card.stats.hypeIndex],['legacyScore',card.stats.legacyScore]] as const;
 useEffect(()=>setMediaError(false),[media]);
 return <article className="hero-fashion-card is-fashion-hype" data-fashion-level={card.rarity} data-power={data?.powerVfx??card.contextVfx?.powerVfx} data-locked={locked?'true':'false'} aria-label={item.name}>
  <span className="hero-fashion-background" data-environment={card.contextVfx?.backgroundEnvironment} aria-hidden/>
  <div className="hero-fashion-front"><header className="fashion-hype-header"><span className="fashion-hype-rarity">{t(`fashionHype.level.${card.rarity}`)}</span><span className="fashion-hype-header-score"><small>HYPE</small>{validStat(card.stats.hypeIndex)&&card.stats.hypeIndex!==null?<LedNumber value={Math.round(card.stats.hypeIndex)}/>:<span>—</span>}</span></header>
   <figure className="hero-fashion-media" aria-label={t('impersonation.media',{name:item.name})}>
    {posterSafe&&(!animate||mock)&&<img className="hero-fashion-poster" src={mediaUrl(poster)} alt={t('impersonation.media',{name:item.name})} loading="lazy"/>}
    {animate&&mock&&<span className="hero-fashion-demo-video" aria-hidden><ArtVideo src={mediaUrl(media)!} poster={mediaUrl(poster)} onStuck={setMediaError}/></span>}
    {animate&&!mock&&(data?.renderedMediaType==='image/gif'?<img className="hero-fashion-motion" src={mediaUrl(media)!} alt={t('impersonation.media',{name:item.name})} onError={()=>setMediaError(true)}/>:<ArtVideo src={mediaUrl(media)!} poster={mediaUrl(poster)} onStuck={setMediaError}/>)}
    {!posterSafe&&!animate&&<span role="status">{t('impersonation.mediaPending')}</span>}
    {!locked&&<span className="hero-fashion-vfx" data-particle={card.contextVfx?.particleType} data-shader={card.contextVfx?.shaderOverlay} aria-hidden/>}
   </figure>
   <div className="hero-fashion-identity"><h3>{item.name}</h3>{serialValid&&<p className="fashion-hype-edition">{card.serialNumber}</p>}<p className="hero-fashion-aura-badge">{impersonation?t('impersonation.title'):t('fashionHype.levels')}</p>
    {data&&<p className="hero-fashion-power">{t(`impersonation.power.${data.powerVfx}`)}</p>}
    {mock&&<p role="status" className="hero-fashion-demo-note">{t('impersonation.mockNotice')}</p>}
    <div className="fashion-hype-tags">{(card.contextBadges??item.styles??[]).slice(0,4).map((tag,i)=><span key={`${tag}-${i}`}>{tag}</span>)}</div>
    <dl className="fashion-hype-matrix" aria-label={t('fashionHype.attributes')}>{stats.map(([key,raw])=>{const value=validStat(raw)?Math.round(raw as number):null;const full=t(`impersonation.stat.${key}`);return <div className="fashion-hype-cell" key={key} data-tone={value===null?undefined:value>=70?'high':value>=40?'mid':'low'} title={`${full}: ${value??'—'}`}><dt><abbr title={full}>{t(`fashionHype.short.${key}`)}</abbr></dt><dd>{value??'—'}</dd></div>;})}</dl>
    {!locked&&media&&<button className="btn btn-sm" type="button" disabled={reduced} onClick={()=>setPlaying(p=>!p)}>{t(reduced?'impersonation.staticMode':playing?'impersonation.pause':'impersonation.play')}</button>}
    {onGenerate&&<button className="btn btn-primary" type="button" disabled={!!locked} onClick={()=>{if(!locked)onGenerate();}}>{t('impersonation.generate')}</button>}{footer}
   </div>
  </div>
  {locked&&<div className="hero-fashion-lock"><span aria-hidden>🔒</span><strong>{t('auraGate.requires',{level:access?.requiredTier??AuraGatingConfig[gated].requiredTier})}</strong><p>{access?.loading?t('auraGate.checking'):getLockedAuraMessage(gated)}</p></div>}
 </article>;
}
