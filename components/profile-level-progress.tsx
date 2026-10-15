'use client';
import {useI18n} from '@/lib/i18n/i18n';
import {LedNumber} from './led-number';
export interface LevelProgress {level:string;lifetime:number;currentThreshold:number;percent:number;nextLevel:{level:string;threshold:number;missing:number}|null;futureLevels:{level:string;threshold:number;missing:number}[]}
export function ProfileLevelProgress({progress}:{progress:LevelProgress}){
 const {t,fmtNumber}=useI18n();const percent=Number.isFinite(progress.percent)?Math.max(0,Math.min(100,Math.floor(progress.percent))):0;
 return <section className="profile-level-progress" aria-label={t('levelProgress.title')}><div className="profile-level-heading"><strong>{t('levelProgress.current',{level:progress.level})}</strong><span className="profile-level-percent"><LedNumber value={percent}/><span>%</span></span></div>
 <div className="profile-level-track" role="progressbar" aria-label={progress.nextLevel?t('levelProgress.to',{level:progress.nextLevel.level}):t('levelProgress.maximum')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{width:`${percent}%`}}/></div>
 <p className="type-caption">{progress.nextLevel?t('levelProgress.missing',{points:fmtNumber(progress.nextLevel.missing),level:progress.nextLevel.level}):t('levelProgress.maximum')}</p>
 {!!progress.futureLevels.length&&<details><summary>{t('levelProgress.future')}</summary><ul>{progress.futureLevels.map(next=><li key={next.level}><strong>{next.level}</strong><span>{t('levelProgress.remaining',{points:fmtNumber(next.missing)})}</span></li>)}</ul></details>}
 </section>;
}
