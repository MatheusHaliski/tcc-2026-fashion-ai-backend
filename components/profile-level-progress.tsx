'use client';
import {useI18n} from '@/lib/i18n/i18n';
import {levelNameKey} from '@/lib/points/hub';
import {LedNumber} from './led-number';
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
