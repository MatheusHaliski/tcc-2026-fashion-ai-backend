"use client";
import { useEffect, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, FileButton } from "@/components/ui";
import { PrivateMotionVideo } from "./private-motion-video";

export interface ImpersonationJob {
 id:string; pieceId:string; status:"QUEUED"|"SUBMITTING"|"PROCESSING"|"READY"|"FAILED"|"CANCELLED";
 mediaUrl?:string|null; posterUrl?:string|null; motionTemplateId:string; failureCode?:string|null;
}
const BASE="/api/me/aura-impersonation";
const active=(job:ImpersonationJob)=>["QUEUED","SUBMITTING","PROCESSING"].includes(job.status);
export function ImpersonationJobsPanel({pieceId,personMediaUrl,template,allowed}:{pieceId:string;personMediaUrl:string;template:string;allowed:boolean}){
 const {t}=useI18n();const {user}=useAuth();
 const capabilities=useApi<{available:boolean}>(signal=>api.get(`${BASE}/capabilities`,{signal}),[user?.id],{enabled:!!user});
 const available=capabilities.data?.available===true&&!capabilities.error;
 const [watch,setWatch]=useState(false);
 const jobs=useApi<ImpersonationJob[]>(signal=>api.get(`${BASE}/jobs`,{signal}),[user?.id],{enabled:!!user,refreshInterval:watch?10000:undefined});
 const [source,setSource]=useState(personMediaUrl);const [inputPreview,setInputPreview]=useState<string|null>(null);
 useEffect(()=>()=>{if(inputPreview)URL.revokeObjectURL(inputPreview);},[inputPreview]);
 const [consent,setConsent]=useState(false);const [publish,setPublish]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [applied,setApplied]=useState<string|null>(null);
 const key=useRef<string|null>(null);const lock=useRef(false);
 useEffect(()=>{key.current=null;setSource(personMediaUrl);setInputPreview(null);setConsent(false);setPublish(false);setApplied(null);setError(null);},[pieceId,personMediaUrl,template]);
 useEffect(()=>setWatch((jobs.data??[]).some(active)),[jobs.data]);
 const relevant=(jobs.data??[]).filter(job=>job.pieceId===pieceId);
 const current=relevant[0];
 async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError(null);try{await action();}catch(e){setError(e instanceof Error?e.message:t("motionJobs.failed"));}finally{lock.current=false;setBusy(false);}}
 function start(){if(!allowed||!available||!source||!consent||relevant.some(active))return;void run(async()=>{
  key.current??=crypto.randomUUID();
  const job=await api.post<ImpersonationJob>(`${BASE}/jobs`,{pieceId,personMediaUrl:source,motionTemplateId:template,requestKey:key.current,processingConsent:true,enableForPiece:true});
  jobs.setData(previous=>[job,...(previous??[]).filter(old=>old.id!==job.id)]);key.current=null;
 });}
 return <section className="grid gap-3 rounded-lg border border-line-soft p-3" aria-label={t("motionJobs.title")}>
  <h3 className="type-h3">{t("motionJobs.title")}</h3><p className="type-body-sm">{t("motionJobs.description")}</p>
  {capabilities.loading?<p role="status">{t("auraGate.checking")}</p>:!available?<p role="status">{t("motionJobs.unavailable")}</p>:null}
  {capabilities.error&&<Button size="sm" onClick={capabilities.reload}>{t("atelier.meta.retry")}</Button>}
  <FileButton accept="image/jpeg,image/png,image/webp" disabled={!available||!allowed||busy} loading={busy} onFiles={files=>{if(!files[0])return;void run(async()=>{const form=new FormData();form.append("file",files[0]);const photo=await api.upload<{url:string}>("/api/try-on/person-photos",form);setSource(photo.url);setInputPreview(URL.createObjectURL(files[0]));setConsent(false);key.current=null;});}}>{t("motionJobs.upload")}</FileButton>
  {(inputPreview||source&&!source.includes("/restricted/"))&&<img src={inputPreview??mediaUrl(source)} alt={t("motionJobs.inputPhoto")} className="max-h-48 w-full object-contain"/>}
  <label className="flex items-start gap-2 type-body-sm"><input type="checkbox" checked={consent} disabled={busy||!available||!allowed} onChange={e=>setConsent(e.target.checked)}/>{t("motionJobs.consent")}</label>
  <Button disabled={!available||!allowed||!source||!consent||busy||relevant.some(active)} loading={busy} onClick={start}>{t("motionJobs.generate")}</Button>
  {jobs.error&&<div role="alert"><p>{t("motionJobs.historyError")}</p><Button size="sm" onClick={jobs.reload}>{t("atelier.meta.retry")}</Button></div>}
  {current&&<div className="grid gap-2"><p className="type-caption">{t("motionJobs.lastGeneration")}</p><p role="status" className="type-body">{t(`motionJobs.status.${current.status}`)}</p>
   {active(current)&&<Button size="sm" disabled={busy} onClick={()=>void run(async()=>{const job=await api.post<ImpersonationJob>(`${BASE}/jobs/${current.id}/cancel`,{});jobs.setData(rows=>(rows??[]).map(row=>row.id===job.id?job:row));})}>{t("motionJobs.cancel")}</Button>}
   {current.status==="FAILED"&&<p role="alert" className="type-body-sm">{t("motionJobs.failed")}</p>}
   {current.status==="READY"&&current.mediaUrl&&<>
    <PrivateMotionVideo key={current.id} jobId={current.id}/>
    <label className="flex items-start gap-2 type-body-sm"><input type="checkbox" checked={publish} onChange={e=>setPublish(e.target.checked)}/>{t("motionJobs.publishConsent")}</label>
    <Button disabled={!publish||busy||!allowed||applied===current.id} onClick={()=>void run(async()=>{await api.post(`${BASE}/jobs/${current.id}/apply`,{publishConsent:true});setApplied(current.id);})}>{t(applied===current.id?"motionJobs.applied":"motionJobs.apply")}</Button>
   </>}
  </div>}
  {error&&<p role="alert" className="type-body-sm">{error}</p>}
 </section>;
}
