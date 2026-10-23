'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button, Card, Dialog, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/ui';
import { api } from '@/lib/api/client';
import { useApi, useAction } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { EMPTY_SPEC, type Invitation, type ProjectDetail, type ProjectDraft } from './contracts';
import { projectApi } from './project-api';
import { ProjectForm } from './project-form';
import styles from './atelier-projects.module.css';
const AtelierHub = dynamic(() => import('@/components/atelier/atelier-hub').then(module => module.AtelierHub));
const TABS = ['projects', 'metamorphoses', 'timeline', 'trends', 'room'] as const;
export function AtelierWorkspace() {
  const { t, fmtDate } = useI18n(); const router = useRouter(); const params = useSearchParams();
  const legacy = TABS.slice(1).includes(params.get('tab') as typeof TABS[1]);
  const [page, setPage] = useState(0); const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft>({ title: '', brief: '', visibility: 'PRIVATE', specification: structuredClone(EMPTY_SPEC), rightsAccepted: false });
  const requestId = useRef(''); const creationPayload = useRef('');
  const query = useApi(signal => projectApi.list(page, signal), [page], { enabled: !legacy });
  const invitations = useApi(signal => api.get<Invitation[]>('/api/atelier/projects/invitations/me', { signal }), [], { enabled: !legacy });
  const action = useAction(async () => { const payload = JSON.stringify(draft); if (payload !== creationPayload.current) { creationPayload.current = payload; requestId.current = crypto.randomUUID(); } const result = await projectApi.create(draft, requestId.current); router.push(`/atelier/projects/${result.project.id}`); setCreating(false); });
  const accepting = useAction(async (invite: Invitation) => { const result = await api.post<ProjectDetail>(`/api/atelier/projects/${invite.projectId}/invites/${invite.id}/accept`); invitations.reload(); query.reload(); router.push(`/atelier/projects/${result.project.id}`); });
  if (legacy) return <div className={styles.stack}><div><Link href="/atelier" className="btn">{t('atelierProjects.backToProjects')}</Link></div><AtelierHub/></div>;
  return <div className={styles.workspace}>
    <PageHeader title={t('atelier.brandTitle')} lead={t('atelierProjects.lead')} actions={<Button variant="primary" onClick={() => { requestId.current = crypto.randomUUID(); setCreating(true); }}>{t('atelierProjects.new')}</Button>}/>
    <Tabs tabs={TABS.map(id => ({ id, label: t(id === 'projects' ? 'atelierProjects.projects' : `atelier.tab.${id}`) }))} value="projects" label={t('atelier.tabs')} onChange={tab => router.replace(tab === 'projects' ? '/atelier' : `/atelier?tab=${tab}`)}/>
    <section className={styles.hero}>
      <div><h2 className="type-h2">{t('atelierProjects.heroTitle')}</h2><p>{t('atelierProjects.heroLead')}</p><p className="type-body-sm">{t('atelierProjects.noManufacturing')}</p></div>
      <GarmentSketch/>
    </section>
    {invitations.error && <ErrorState error={invitations.error} onRetry={invitations.reload}/>}
    {accepting.error && <ErrorState error={accepting.error}/>}
    {!!invitations.data?.length && <section className={styles.stack}><h2 className="type-h3">{t('atelierProjects.invitations')}</h2>{invitations.data.map(invite => <Card key={invite.id}><div className={styles.actions}><strong>{invite.projectTitle}</strong><span>{t(`atelierProjects.role.${invite.role}`)}</span><span>{t('atelierProjects.expires', { date: fmtDate(invite.expiresAt) })}</span><Button loading={accepting.busy} onClick={() => void accepting.run(invite)}>{t('atelierProjects.acceptInvite')}</Button></div></Card>)}</section>}
    {query.error && <ErrorState error={query.error} onRetry={query.reload}/>}
    {query.loading ? <Skeleton className="h-48"/> : !query.error && !query.data?.items.length ? <EmptyState title={t('atelierProjects.empty')} hint={t('atelierProjects.emptyHint')}/> : <div className={styles.grid}>{query.data?.items.map(project => <Card key={project.id}><article className={styles.card}><div className={styles.meta}><span>{t(`atelierProjects.state.${project.state}`)}</span><span>{t(`atelierProjects.visibility.${project.visibility}`)}</span></div><h2 className="type-h3"><Link href={`/atelier/projects/${project.id}`}>{project.title}</Link></h2><p>{project.brief}</p><div className={styles.meta}><span>{t('atelierProjects.revisionNumber', { number: project.revisionNumber })}</span><span>{fmtDate(project.updatedAt)}</span></div><Link className="btn" href={`/atelier/projects/${project.id}`}>{t('atelierProjects.open')}</Link></article></Card>)}</div>}
    <div className={styles.actions}>{page > 0 && <Button onClick={() => setPage(page - 1)}>{t('atelierProjects.previous')}</Button>}{query.data?.hasMore && <Button onClick={() => setPage(page + 1)}>{t('atelierProjects.next')}</Button>}</div>
    <Dialog open={creating} onClose={() => setCreating(false)} title={t('atelierProjects.new')} size="lg"><form onSubmit={e => { e.preventDefault(); void action.run(); }} className={styles.stack}><ProjectForm draft={draft} onChange={setDraft} disabled={action.busy}/>{action.error && <ErrorState error={action.error}/>}<Button type="submit" variant="primary" loading={action.busy}>{t('atelierProjects.create')}</Button></form></Dialog>
  </div>;
}
export function GarmentSketch() { const { t } = useI18n(); return <figure><svg viewBox="0 0 250 190" className={styles.sketch} role="img" aria-label={t('atelierProjects.sketchLabel')}><line x1="125" y1="0" x2="125" y2="190"/><path d="M89 28 63 40 29 85 58 103 77 81 73 162 177 162 173 81 192 103 221 85 187 40 161 28 Q153 51 125 51 Q97 51 89 28Z"/><path d="M89 28 Q125 71 161 28M77 81 80 48M173 81 170 48M75 150 175 150"/><rect x="139" y="81" width="23" height="27"/><path d="M139 81 151 89 162 81"/></svg><figcaption className="type-body-sm">{t('atelierProjects.sketchCaption')}</figcaption></figure>; }
