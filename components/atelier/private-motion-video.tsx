"use client";
import {useEffect,useRef,useState} from "react";
import {api} from "@/lib/api/client";
import {useI18n} from "@/lib/i18n/i18n";
import {Button} from "@/components/ui";
import {ArtVideo} from "@/components/card-art";
/** Load on explicit request with the owner's JWT; private URLs never enter a public video tag. */
export function PrivateMotionVideo({jobId,path}:{jobId:string;path?:string}){
 const {t}=useI18n();const [url,setUrl]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [failed,setFailed]=useState(false);
 const generation=useRef(0);const live=useRef<string|null>(null);
 useEffect(()=>{
  setUrl(null);setBusy(false);setFailed(false);
  return ()=>{generation.current++;if(live.current)URL.revokeObjectURL(live.current);live.current=null;};
 },[jobId,path]);
 async function load(){if(busy)return;const version=++generation.current;setBusy(true);setFailed(false);try{
  const loaded=await api.blobUrl(path??`/api/me/aura-impersonation/jobs/${encodeURIComponent(jobId)}/media`);
  if(version!==generation.current){URL.revokeObjectURL(loaded);return;}live.current=loaded;setUrl(loaded);
 }catch{if(version===generation.current)setFailed(true);}finally{if(version===generation.current)setBusy(false);}}
 function close(){generation.current++;if(live.current)URL.revokeObjectURL(live.current);live.current=null;setUrl(null);setBusy(false);}
 return <div className="grid gap-2" onClick={event=>{event.preventDefault();event.stopPropagation();}}>
  {url?<><div className="relative aspect-[2/3] overflow-hidden rounded-lg"><ArtVideo src={url}/></div><Button size="sm" onClick={close}>{t("motionJobs.closeVideo")}</Button></>:<Button size="sm" loading={busy} onClick={()=>void load()}>{t("motionJobs.loadVideo")}</Button>}
  {failed&&<p role="alert" className="type-body-sm">{t("motionJobs.mediaError")}</p>}
 </div>;
}
