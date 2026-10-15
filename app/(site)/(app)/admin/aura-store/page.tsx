'use client';
import {useState} from 'react';
import {RequireAuth} from '@/components/app-shell';
import {api} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {useI18n} from '@/lib/i18n/i18n';
import {Button,ErrorState,Field,Input,PageHeader,Select,Skeleton,Switch,useToast} from '@/components/ui';
import {HYPE_PRESETS} from '@/lib/hype/aura-hype-presets';
interface Offer{code:string;name:string;family:'HYPE'|'METAMORPHOSE';pricePoints:number;active:boolean;config:Record<string,unknown>}
export default function Page(){return <RequireAuth admin><AdminArts/></RequireAuth>;}
function AdminArts(){
 const {t}=useI18n();const toast=useToast();const query=useApi<Offer[]>((signal)=>api.get('/api/admin/aura-store',{signal}),[]);
 const [code,setCode]=useState('HYPE_SCAN_GRAPHITE'),[name,setName]=useState(''),[price,setPrice]=useState('150'),[mode,setMode]=useState(HYPE_PRESETS[0].id),[active,setActive]=useState(false),[busy,setBusy]=useState(false);
 const save=async()=>{if(busy)return;setBusy(true);try{await api.post('/api/admin/aura-store',{code,name,family:'HYPE',pricePoints:Number(price),active,config:{auraHype:mode}});await query.reload();toast.success(t('common.saved'));}catch(e){toast.error(String(e));}finally{setBusy(false);}};
 const toggle=async(offer:Offer)=>{if(busy)return;setBusy(true);try{await api.post('/api/admin/aura-store',{...offer,active:!offer.active});await query.reload();}catch(e){toast.error(String(e));}finally{setBusy(false);}};
 return <><PageHeader title={t('adminArts.title')} lead={t('myArts.issuerHint')}/><div className="surface grid gap-4 p-5">
  <Field label={t('adminArts.code')} id="art-code"><Input id="art-code" value={code} onChange={e=>setCode(e.target.value)}/></Field>
  <Field label={t('common.name')} id="art-name"><Input id="art-name" value={name} onChange={e=>setName(e.target.value)}/></Field>
  <Field label={t('adminArts.price')} id="art-price"><Input id="art-price" type="number" min="0" max="1000000" value={price} onChange={e=>setPrice(e.target.value)}/></Field>
  <Field label={t('auraHype.title')} id="art-mode"><Select id="art-mode" value={mode} onChange={e=>setMode(e.target.value)}>{HYPE_PRESETS.map(p=><option key={p.id} value={p.id}>{t(`auraHype.tech.${p.tech}`)} · {t(`auraHype.palette.${p.palette}`)}</option>)}</Select></Field>
  <Switch label={t('adminArts.active')} checked={active} onChange={setActive}/><Button disabled={busy||!name.trim()} onClick={save}>{t('common.save')}</Button>
 </div>{query.loading?<Skeleton className="h-40"/>:query.error?<ErrorState error={query.error} onRetry={query.reload}/>:<div className="opt-grid mt-5">{query.data?.map(offer=><article className="surface p-4" key={offer.code}><h3 className="type-heading">{offer.name}</h3><p>{offer.family} · {offer.pricePoints} FAI Points</p><Button disabled={busy} onClick={()=>toggle(offer)}>{t(offer.active?'adminArts.unpublish':'adminArts.publish')}</Button></article>)}</div>}</>;
}
