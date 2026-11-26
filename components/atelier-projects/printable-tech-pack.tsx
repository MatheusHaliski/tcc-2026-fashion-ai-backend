'use client';
import Link from 'next/link';
import { Button, Card, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { useAction, useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { SPEC_FIELDS } from './contracts';
import { downloadTechPack, projectApi } from './project-api';
import styles from './atelier-projects.module.css';

/** React escapes all author-supplied text; the sheet never injects HTML from specifications. */
export function PrintableTechPack({ id, revisionId }: { id: string; revisionId: string }) {
  const { t, fmtDateTime } = useI18n();
  const query = useApi(() => projectApi.export(id, revisionId), [id, revisionId]);
  const action = useAction(async () => { if (query.data) await downloadTechPack(id, query.data.revision); });
  if (!query.data) return query.error ? <ErrorState error={query.error} onRetry={query.reload}/> : <Skeleton className="h-64"/>;
  const pack = query.data; const revision = pack.revision;
  return <article className={`${styles.workspace} ${styles.printSheet}`}>
    <nav className={`${styles.actions} ${styles.printActions}`}><Link className="btn" href={`/atelier/projects/${id}`}>{t('atelierProjects.backToProject')}</Link><Button onClick={() => window.print()}>{t('atelierProjects.print')}</Button><Button loading={action.busy} onClick={() => void action.run()}>{t('atelierProjects.export')}</Button></nav>
    <PageHeader title={t('atelierProjects.techPack')} lead={revision.title}/>
    <div className={styles.meta}><span>{t('atelierProjects.revisionNumber', { number: revision.number })}</span><span>{revision.authorName}</span><span>{fmtDateTime(revision.createdAt)}</span><strong>{t(pack.reviewStatus === 'REVIEWED_FOR_SHOWCASE' ? 'atelierProjects.state.APPROVED_FOR_SHOWCASE' : 'atelierProjects.state.DRAFT')}</strong></div>
    <p>{revision.brief}</p><p className={styles.note}>{t('atelierProjects.noManufacturing')}</p>
    {action.error && <ErrorState error={action.error}/>}
    {!!pack.missingFields.length && <Card><h2 className="type-h3">{t('atelierProjects.missingFields')}</h2><ul>{pack.missingFields.map(field => <li key={field}>{t(`atelierProjects.field.${field}`)}</li>)}</ul></Card>}
    <dl className={styles.formGrid}>{SPEC_FIELDS.map(field => <div key={field} className={styles.comment}><dt className="font-semibold">{t(`atelierProjects.field.${field}`)}</dt><dd>{revision.specification[field] || t('atelierProjects.unspecified')}</dd></div>)}</dl>
    <section><h2 className="type-h3">{t('atelierProjects.field.measurements')}</h2><p>{t('atelierProjects.measurementHint')}</p><div className={styles.scroll}><table className={styles.compare}><thead><tr><th>{t('atelierProjects.measurementPoint')}</th><th>{t('atelierProjects.measurementProtocol')}</th><th>{t('atelierProjects.centimeters')}</th></tr></thead><tbody>{revision.specification.measurements.map((m, index) => <tr key={index}><th scope="row">{m.point}</th><td>{m.protocol}</td><td>{m.centimeters}</td></tr>)}</tbody></table></div>{!revision.specification.measurements.length && <p>{t('atelierProjects.unspecified')}</p>}</section>
    <section><h2 className="type-h3">{t('atelierProjects.reviews')}</h2><p>{t('atelierProjects.reviewHint')}</p>{pack.reviews.length ? pack.reviews.map(review => <div key={review.id} className={styles.comment}><strong>{t(`atelierProjects.decision.${review.decision}`)} · {review.authorName}</strong><p>{review.notes}</p><p>{fmtDateTime(review.createdAt)}</p></div>) : <p>{t('atelierProjects.noReview')}</p>}</section>
    <footer className={styles.note}><p>{t('atelierProjects.revisionLicense')}</p><p>{t('atelierProjects.documentReference', { project: id, revision: revision.id })}</p>{revision.parentRevisionId && <p>{t('atelierProjects.parentReference', { id: revision.parentRevisionId })}</p>}{revision.sourceRevisionId && <p>{t('atelierProjects.restoreReference', { id: revision.sourceRevisionId })}</p>}</footer>
  </article>;
}
