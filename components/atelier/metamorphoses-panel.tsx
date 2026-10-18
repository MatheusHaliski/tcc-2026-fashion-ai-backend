'use client';
import {ImpersonationJobsPanel} from './impersonation-jobs-panel';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import dynamic from 'next/dynamic';
import {api} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {useAuth} from '@/lib/auth/session';
import {useI18n} from '@/lib/i18n/i18n';
import type {PieceView} from '@/lib/api/types';
import type {AtelierPhoto} from '@/lib/atelier/types';
import type {OwnedFashionCard} from '@/lib/fashion-card/types';
import {AuraContextEngineService,AuraPresetResolver,InMemoryAuraPresetRepository} from '@/lib/fashion-card/aura-context-engine';
import {AuraImpersonationService,FashionCardPipelineService,InMemoryOwnedFashionCardRepository,MockFashionMotionWorker,MOTION_TEMPLATES} from '@/lib/fashion-card/aura-impersonation-service';
import type {RoomTier} from '@/lib/fashion-card/aura-gating';
import {FashionCardComponent} from '@/components/fashion-card/fashion-card-component';
import {Button,ErrorState,Skeleton,useToast} from '@/components/ui';
const Library=dynamic(()=>import('./photo-library').then(m=>m.PhotoLibrary),{loading:()=> <Skeleton className="h-64"/>});
interface Permissions {currentTier:RoomTier;auras:{AURA_IMPERSONATION:{allowed:boolean;requiredTier:RoomTier}}}
export function MetamorphosesPanel(){
 const requestedPiece=useSearchParams().get('pieceId');
 const {t}=useI18n();const {me}=useAuth();const toast=useToast();
 const photos=useApi<{items:AtelierPhoto[];total:number;hasMore:boolean}>(signal=>api.get('/api/me/photos?origin=WARDROBE_ITEM&page=0&size=60',{signal}),[]);
 const permissions=useApi<Permissions>(signal=>api.get('/api/me/aura-permissions',{signal}),[]);
 const [selected,setSelected]=useState('');const [template,setTemplate]=useState('STREET_IMPACT');const [result,setResult]=useState<OwnedFashionCard|null>(null);const [busy,setBusy]=useState(false);const [library,setLibrary]=useState(false);const [stage,setStage]=useState(0);const processing=useRef<AbortController|null>(null);
 useEffect(()=>()=>processing.current?.abort(),[]);
 const candidates=photos.data?.items.filter(photo=>photo.subject?.kind==='PIECE'&&photo.url)??[];const photo=candidates.find(p=>p.id===selected)??candidates.find(p=>p.subject?.id===requestedPiece)??(requestedPiece?undefined:candidates[0]);const rule=permissions.data?.auras.AURA_IMPERSONATION;
 async function preview(){
  if(!photo?.subject||!photo.url||!me||busy||!rule?.allowed)return;
  const abort=new AbortController();processing.current=abort;setBusy(true);setStage(1);setResult(null);
  try{
   const details=await api.get<{piece:PieceView}>(`/api/pieces/${photo.subject.id}`,{signal:abort.signal});
   if(details.piece.owner.id!==me.user.id)throw new Error(t('atelier.meta.ownerRequired'));
   const piece=details.piece;
   const card:OwnedFashionCard={ownerId:me.user.id,entityId:photo.subject.id,entityType:'PIECE',revision:0,metadata:{...(piece.auraContext??{brand:piece.brandName??'',brandId:piece.brandId??undefined,styleCategory:piece.style?.join(' '),occasion:piece.occasion?.join(' ')}),colorHex:piece.colorHex??undefined,colorName:piece.color??undefined},fashionCard:{rarity:'COMMON',auraType:'COMMON',stats:{versatility:null,hypeIndex:null,legacyScore:null}}};
   const service=new AuraImpersonationService(new AuraPresetResolver(new AuraContextEngineService(),new InMemoryAuraPresetRepository()),new FashionCardPipelineService(new MockFashionMotionWorker()),new InMemoryOwnedFashionCardRepository([card]),{canUserEquipAura:async()=>rule.allowed});
   setStage(2);const generated=await service.generateImpersonationAura({ownerId:me.user.id,entityType:'PIECE',entityId:photo.subject.id,userMediaUrl:photo.url,motionTemplateId:template},abort.signal);abort.signal.throwIfAborted();setResult(generated);setStage(3);
  }catch(error){if(!abort.signal.aborted)toast.fromError(error);}finally{if(!abort.signal.aborted)setBusy(false);}
 }
 const display=result?.entityId===photo?.subject?.id?result:null;
 return <div className="atelier-metamorphoses"><div className="atelier-section-heading"><div><h2>{t('atelier.meta.title')}</h2><p>{t('atelier.meta.hint')}</p></div><Link href="/settings" className="btn">{t('atelier.meta.settings')}</Link></div><div className="atelier-workbench">
  <section className="atelier-workbench-controls"><p className="atelier-demo-notice" role="note">{t('atelier.meta.demo')}</p>
   {photos.loading?<Skeleton className="h-24"/>:photos.error?<ErrorState error={photos.error} onRetry={photos.reload}/>:<label className="label">{t('atelier.meta.photo')}<select className="input" value={photo?.id??''} disabled={!candidates.length||busy} onChange={e=>{setSelected(e.target.value);setResult(null);setStage(0);}}>{!photo&&<option value="">{t('atelier.meta.noPhoto')}</option>}{candidates.map(p=><option value={p.id} key={p.id}>{p.subject!.title}</option>)}</select></label>}
   <label className="label">{t('atelier.meta.motion')}<select className="input" value={template} disabled={busy} onChange={e=>{setTemplate(e.target.value);setResult(null);setStage(0);}}>{MOTION_TEMPLATES.map(option=><option key={option.id} value={option.id}>{t(`atelier.motion.${option.id}`)}</option>)}</select></label>
   <ol className="atelier-processing-steps">{['source','context','preview'].map((key,i)=><li key={key} data-done={stage>i?'true':'false'}><span aria-hidden="true">{stage>i?'✓':`0${i+1}`}</span>{t(`atelier.meta.step.${key}`)}</li>)}</ol>
   <p role="status">{permissions.loading?t('auraGate.checking'):permissions.error?t('atelier.meta.permissionError'):!rule?.allowed?t('atelier.meta.locked',{current:permissions.data?.currentTier??'—',required:rule?.requiredTier??'LOFT'}):t('atelier.meta.unlocked')}</p>
   {permissions.error&&<Button onClick={permissions.reload}>{t('atelier.meta.retry')}</Button>}
   <Button variant="primary" disabled={!rule?.allowed||!photo?.url||busy} loading={busy} onClick={preview}>{t('atelier.meta.generatePreview')}</Button>
   {busy&&<progress max={3} value={stage} aria-label={t('atelier.meta.processing')}/>}
   <p className="type-body-sm">{t('atelier.meta.previewLimits')}</p>
   {(photo?.subject||requestedPiece)&&<ImpersonationJobsPanel pieceId={photo?.subject?.id??requestedPiece!} personMediaUrl={photo?.url??''} template={template} allowed={rule?.allowed===true}/> }
  </section>
  <div className="atelier-workbench-preview">{photo?<FashionCardComponent key={`${photo.id}-${template}`} item={{id:photo.subject!.id,name:photo.subject!.title,imageUrl:photo.url,styles:photo.subject?.style,fashionCard:display?.fashionCard??{rarity:'COMMON',auraType:'IMPERSONATION',stats:{versatility:null,hypeIndex:null,legacyScore:null}}}} access={{allowed:rule?.allowed===true,requiredTier:rule?.requiredTier??'LOFT',loading:permissions.loading}}/>:<div className="atelier-preview-empty"><span aria-hidden="true">✧</span><p>{t('atelier.meta.empty')}</p></div>}</div>
 </div>
 <div className="atelier-library-toggle"><Button aria-expanded={library} onClick={()=>setLibrary(v=>!v)}>{t(library?'atelier.meta.closeLibrary':'atelier.library')}</Button><Link href="/atelier/galeria" className="btn btn-ghost">{t('atelier.meta.openLibrary')}</Link></div>
 {library&&<div className="atelier-photo-library"><Library/></div>}
 </div>;
}
