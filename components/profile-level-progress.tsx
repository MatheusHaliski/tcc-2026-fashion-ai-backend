'use client';
import {useI18n} from '@/lib/i18n/i18n';
import {levelNameKey} from '@/lib/points/hub';
import {LedNumber} from './led-number';
import {useState} from 'react';
import {Dialog} from '@/components/ui';
export interface LevelProgress {level:string;lifetime:number;currentThreshold:number;percent:number;nextLevel:{level:string;threshold:number;missing:number}|null;futureLevels:{level:string;threshold:number;missing:number}[]}
export function ProfileLevelProgress({progress}:{progress:LevelProgress}){
 const {t,fmtNumber}=useI18n();const percent=Number.isFinite(progress.percent)?Math.max(0,Math.min(100,Math.floor(progress.percent))):0;
 const current=t(levelNameKey(progress.level));const next=progress.nextLevel?{...progress.nextLevel,displayName:t(levelNameKey(progress.nextLevel.level))}:null;
 return <section className="profile-level-progress" aria-label={t('levelProgress.title')}><div className="profile-level-heading"><strong>{t('levelProgress.current',{level:current})}</strong><span className="profile-level-percent"><LedNumber value={percent}/><span>%</span></span></div>
 <div className="profile-level-track" role="progressbar" aria-label={next?t('levelProgress.to',{level:next.displayName}):t('levelProgress.maximum')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{width:`${percent}%`}}/></div>
 <p className="type-caption">{next?t('levelProgress.missing',{points:fmtNumber(next.missing),level:next.displayName}):t('levelProgress.maximum')}</p>
 {!!progress.futureLevels.length&&<details><summary>{t('levelProgress.future')}</summary><ul>{progress.futureLevels.map(next=><li key={next.level}><strong>{t(levelNameKey(next.level))}</strong><span>{t('levelProgress.remaining',{points:fmtNumber(next.missing)})}</span></li>)}</ul></details>}
 </section>;
}

/**
 * Perfil: o nível fica discreto ao lado do nome (como os outros selos do cabeçalho), com a porcentagem em texto; o
 * clique abre o progresso com barra, porcentagem e quanto falta — números e textos comuns, sem o placar de LED.
 */
export function ProfileLevelChip({progress}:{progress:LevelProgress}){
 const {t,fmtNumber}=useI18n();const [open,setOpen]=useState(false);
 const percent=Number.isFinite(progress.percent)?Math.max(0,Math.min(100,Math.floor(progress.percent))):0;
 const current=t(levelNameKey(progress.level));const next=progress.nextLevel?{...progress.nextLevel,displayName:t(levelNameKey(progress.nextLevel.level))}:null;
 return <>
  <button type="button" className="level-chip" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-label={t('levelProgress.abrir',{level:current,percent})}>
   <span>{current}</span>{next&&<span className="level-chip-pct tabular">{percent}%</span>}
  </button>
  <Dialog open={open} onClose={()=>setOpen(false)} title={t('levelProgress.title')}>
   <div className="level-details">
    <div className="level-details-head"><strong>{t('levelProgress.current',{level:current})}</strong>{next&&<span className="tabular">{percent}%</span>}</div>
    <div className="level-details-track" role="progressbar" aria-label={next?t('levelProgress.to',{level:next.displayName}):t('levelProgress.maximum')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={next?percent:100}><i style={{width:`${next?percent:100}%`}}/></div>
    <p className="type-body-sm text-muted">{next?t('levelProgress.missing',{points:fmtNumber(next.missing),level:next.displayName}):t('levelProgress.maximum')}</p>
    {!!progress.futureLevels.length&&<><p className="label mt-3">{t('levelProgress.future')}</p><ul className="level-details-list">{progress.futureLevels.map(f=><li key={f.level}><span>{t(levelNameKey(f.level))}</span><span className="tabular text-muted">{t('levelProgress.remaining',{points:fmtNumber(f.missing)})}</span></li>)}</ul></>}
   </div>
  </Dialog>
 </>;
}
