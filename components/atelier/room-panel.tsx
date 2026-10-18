'use client';
import {useState} from 'react';
import Link from 'next/link';
import {api,mediaUrl} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {useI18n} from '@/lib/i18n/i18n';
import type {AtelierRewardSystem} from '@/lib/atelier/types';
import type {StoreItem} from '@/components/room3d/wardrobe-creator';
import {Button,Dialog,EmptyState,ErrorState,Select,Skeleton,useToast} from '@/components/ui';
import {moduleLabel} from '@/components/room3d/room-store';
interface OwnedItem extends StoreItem {inventory?:{inventoryId:string;appliedModule?:string|null}[]}
export function AtelierRoomPanel({rewards}:{rewards?:AtelierRewardSystem}){
 const {t}=useI18n();const toast=useToast();const query=useApi<OwnedItem[]>(signal=>api.get('/api/points/shop',{signal}),[]);const [install,setInstall]=useState<{item:OwnedItem;id:string}|null>(null);const [module,setModule]=useState('');const [busy,setBusy]=useState(false);
 const owned=(query.data??[]).filter(item=>item.inventory?.length);const categories=['habitableTrofeus','directorPower','collectiveWork','seasonPasses'] as const;
 async function confirm(){if(!install||!module||busy)return;setBusy(true);try{await api.post(`/api/me/room-inventory/${install.id}/apply`,{moduleId:module});setInstall(null);query.reload();toast.success(t('atelier.room.installed'));}catch(e){toast.fromError(e);}finally{setBusy(false);}}
 return <div><div className="atelier-section-heading"><div><h2>{t('atelier.room.title')}</h2><p>{t('atelier.room.hint')}</p></div><Link href="/room" className="btn btn-primary">{t('atelier.visitRoom')}</Link></div>
 <div className="atelier-earned-grid">{categories.map(category=><section className="atelier-earned" key={category}><h3>{t(`atelier.category.${category}`)}</h3>{!rewards?<p>{t('atelier.rewardsUnavailable')}</p>:rewards.categories[category]?.length?rewards.categories[category].map(reward=><article key={reward.id}><h4>{reward.title}</h4><p>{reward.description}</p></article>):<p>{t('atelier.room.noRewards')}</p>}</section>)}</div>
 <h3 className="type-h3 mt-5">{t('atelier.room.owned')}</h3><p>{t('atelier.room.ownedHint')}</p>
 {query.loading?<Skeleton className="h-48"/>:query.error?<ErrorState error={query.error} onRetry={query.reload}/>:!owned.length?<EmptyState title={t('atelier.room.empty')} action={<Link className="btn" href="/points/loja">{t('atelier.room.store')}</Link>}/>:<div className="atelier-inventory-grid">{owned.flatMap(item=>item.inventory!.map(unit=><article key={unit.inventoryId} className="atelier-inventory-item"><span aria-hidden="true" className="atelier-inventory-icon">◇</span>{item.artUrl&&<img src={mediaUrl(item.artUrl)} alt="" loading="lazy"/>}<h4>{item.name}</h4><p>{unit.appliedModule?t('atelier.room.module',{module:moduleLabel(unit.appliedModule)}):t('atelier.room.boxed')}</p><Button disabled={!item.compatibleModules?.length} onClick={()=>{setInstall({item,id:unit.inventoryId});setModule(item.compatibleModules?.[0]??'');}}>{t('atelier.room.install')}</Button></article>))}</div>}
 <Dialog open={!!install} onClose={()=>{if(!busy)setInstall(null);}} title={t('atelier.room.installTitle',{name:install?.item.name??''})} footer={<><Button disabled={busy} onClick={()=>setInstall(null)}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} disabled={!module} onClick={confirm}>{t('atelier.room.install')}</Button></>}><p>{t('atelier.room.installHint')}</p><label className="label">{t('atelier.room.target')}<Select aria-label={t('atelier.room.target')} value={module} onChange={e=>setModule(e.target.value)}>{install?.item.compatibleModules?.map(id=><option key={id} value={id}>{moduleLabel(id)}</option>)}</Select></label></Dialog>
 </div>;
}
