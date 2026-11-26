'use client';
import Link from 'next/link';
import { Card, Skeleton } from '@/components/ui';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { projectApi } from '@/components/atelier-projects/project-api';

export const orderHref = (projectId: string, revisionId?: string | null) =>
  `/atelier/projects/${encodeURIComponent(projectId)}/order${revisionId ? `?revision=${encodeURIComponent(revisionId)}` : ''}`;

/**
 * Entrada da encomenda no projeto do Atelier: habilitada só quando a revisão publicada tem ficha completa (mesma regra
 * da ficha técnica); senão lista o que falta. Revisões novas mudam o que será produzido: o cartão diz qual vale.
 */
export function FactoryOrderCard({ projectId, revisionId, revisionNumber }: { projectId: string; revisionId: string; revisionNumber: number }) {
  const { t } = useI18n();
  const pack = useApi(() => projectApi.export(projectId, revisionId), [projectId, revisionId]);
  const missing = pack.data?.missingFields ?? [];
  return <Card>
    <h2 className="type-h3">{t('garmentDelivery.cta.title')}</h2>
    <p>{t('garmentDelivery.cta.lead', { number: revisionNumber })}</p>
    {pack.loading && !pack.data ? <Skeleton className="h-10" /> : missing.length ? <>
      <p role="status">{t('garmentDelivery.missing.title')}</p>
      <ul className="list-disc pl-5">{missing.map(field => <li key={field}>{t(`atelierProjects.field.${field}`)}</li>)}</ul>
      <p className="type-body-sm">{t('garmentDelivery.cta.completeHint')}</p>
      <Link className="btn" href={`/atelier/projects/${encodeURIComponent(projectId)}/editor`}>{t('atelier3d.openEditor')}</Link>
    </> : <Link className="btn btn-primary" href={orderHref(projectId, revisionId)}>{t('garmentDelivery.cta.order')}</Link>}
    <p className="type-body-sm"><Link href="/atelier/orders">{t('garmentDelivery.cta.myOrders')}</Link></p>
  </Card>;
}
