'use client';
import {useState} from 'react';
import {RequireAuth} from '@/components/app-shell';
import {api,ApiError} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {useI18n} from '@/lib/i18n/i18n';
import {Button,Dialog,EmptyState,ErrorState,PageHeader,Skeleton,UiIcon,useToast} from '@/components/ui';
import {FaiIcon} from '@/components/fai-icon';
interface Offer{code:string;name:string;family:string;pricePoints:number;active:boolean}
export default function Page(){return <RequireAuth><ArtsStore/></RequireAuth>;}
function ArtsStore(){
 const {t}=useI18n();const toast=useToast();const query=useApi<Offer[]>((signal)=>api.get('/api/aura-store',{signal}),[]);
 const [info,setInfo]=useState<Offer|null>(null);const [purchaseError,setPurchaseError]=useState<string|null>(null);
 const [selected,setSelected]=useState<Offer|null>(null);const [busy,setBusy]=useState(false);
 const buy=async()=>{if(!selected||busy)return;setBusy(true);try{await api.post(`/api/aura-store/${selected.code}/purchase`,{});toast.success(t('myArts.purchased'));setSelected(null);}catch(e){setSelected(null);setPurchaseError(e instanceof ApiError?e.message:t('store.purchaseFailed'));}finally{setBusy(false);}};
 return <><PageHeader title={t('myArts.store')} lead={t('myArts.issuerHint')}/>{query.loading?<Skeleton className="h-48"/>:query.error?<ErrorState error={query.error} onRetry={query.reload}/>:!query.data?.length?<EmptyState title={t('myArts.storeEmpty')}/>:<div className="opt-grid">{query.data.map(offer=><article className="surface p-4" key={offer.code}><UiIcon name="sparkles" size={24}/><h3 className="type-heading">{offer.name}</h3><p className="type-body"><FaiIcon id="ACT-40" size={20} decorative/> {offer.pricePoints} FAI Points</p><Button onClick={()=>setInfo(offer)}><UiIcon name="info" size={18}/>{t('store.moreInfo')}</Button><Button onClick={()=>setSelected(offer)}>{t('myArts.buyLicense')}</Button></article>)}</div>}
 <Dialog open={!!purchaseError} onClose={()=>setPurchaseError(null)} title={t('store.purchaseRejected')}><p role="alert">{purchaseError}</p></Dialog>
 <Dialog open={!!info} onClose={()=>setInfo(null)} title={info?.name??t('store.moreInfo')}><p>{t('myArts.issuerHint')}</p><p>{t('myArts.purchased')}</p></Dialog>
 <Dialog open={!!selected} onClose={()=>{if(!busy)setSelected(null);}} title={t('myArts.buyLicense')} footer={<Button onClick={buy} disabled={busy}>{t('myArts.confirm')}</Button>}><p className="type-body">{selected?.name} · {selected?.pricePoints} FAI Points</p><p>{t('myArts.issuerHint')}</p><p>{t('store.confirmHint')}</p></Dialog></>;
}
