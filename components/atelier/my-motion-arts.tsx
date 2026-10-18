"use client";
import Link from "next/link";
import {PrivateMotionVideo} from "./private-motion-video";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import type {ImpersonationJob} from "./impersonation-jobs-panel";
/** Personal renders are separate from institutional licences. Viewing grants no XP or licence. */
export function MyMotionArts(){
 const {t}=useI18n();
 const query=useApi<ImpersonationJob[]>(signal=>api.get('/api/me/aura-impersonation/jobs',{signal}),[]);
 const ready=(query.data??[]).filter(job=>job.status==='READY'&&job.mediaUrl);
 return <section className="grid gap-3" aria-label={t('motionJobs.myArts')}><h3 className="type-h3">{t('motionJobs.myArts')}</h3>
  {query.loading?<p role="status">{t('auraGate.checking')}</p>:query.error?<div role="alert"><p>{t('motionJobs.historyError')}</p><Button onClick={query.reload}>{t('atelier.meta.retry')}</Button></div>:!ready.length?<p className="type-body-sm">{t('motionJobs.noArts')}</p>:<div className="opt-grid">{ready.map(job=><article key={job.id} className="surface p-3">
   <PrivateMotionVideo jobId={job.id}/>
   <Link className="btn mt-2" href={`/atelier?tab=metamorphoses&pieceId=${encodeURIComponent(job.pieceId)}`}>{t('motionJobs.manage')}</Link>
  </article>)}</div>}
 </section>;
}
