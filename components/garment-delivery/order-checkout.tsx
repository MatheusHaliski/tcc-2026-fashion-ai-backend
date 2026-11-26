'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { useAction, useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { projectApi } from '@/components/atelier-projects/project-api';
import { garmentOrderApi } from './api';
import { CareLabelView } from './care-label';
import { GarmentPreview, MissingFields, PassportPreview, SizeSection } from './checkout-sections';
import { CheckoutSummary, DeliverySection, SpeedSection } from './checkout-summary';
import { onlyDigits, type OrderDraft } from './contracts';
import styles from './garment-delivery.module.css';

/** Checkout da encomenda: revisão escolhida (ou a publicada mais recente) do projeto do Atelier. */
export function OrderCheckout({ projectId, revisionId }: { projectId: string; revisionId?: string | null }) {
  const { t } = useI18n();
  const project = useApi(signal => projectApi.get(projectId, signal), [projectId], { enabled: !revisionId });
  const revision = revisionId ?? project.data?.latestRevision?.id ?? null;
  if (!revision) {
    if (project.error) return <ErrorState error={project.error} onRetry={project.reload} />;
    if (project.loading) return <Skeleton className="h-64" />;
    return <div className={styles.page}>
      <PageHeader title={t('garmentDelivery.checkout.title')} lead={t('garmentDelivery.checkout.noRevision')} />
      <div><Link className="btn" href={`/atelier/projects/${encodeURIComponent(projectId)}`}>{t('atelierProjects.backToProject')}</Link></div>
    </div>;
  }
  return <Checkout key={revision} projectId={projectId} revisionId={revision} />;
}

function Checkout({ projectId, revisionId }: { projectId: string; revisionId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [draft, setDraft] = useState<OrderDraft>({ size: '', cep: '', deliveryLabel: '', speed: 'STANDARD' });
  const cep = onlyDigits(draft.cep);
  const ready = cep.length === 8;
  const quote = useApi(signal => garmentOrderApi.quote(projectId, revisionId, { size: draft.size, speed: draft.speed, cep: ready ? cep : '' }, signal),
    [projectId, revisionId, draft.size, draft.speed, ready ? cep : '']);
  const requestId = useRef('');
  const payload = useRef('');
  const confirm = useAction(async () => {
    const body: OrderDraft = { ...draft, cep, size: draft.size || quote.data?.sizes.selected || '' };
    const serialized = JSON.stringify(body);
    if (serialized !== payload.current) {
      payload.current = serialized;
      requestId.current = crypto.randomUUID();
    }
    const order = await garmentOrderApi.create(projectId, revisionId, body, requestId.current);
    router.push(`/atelier/orders/${order.id}`);
  });
  const data = quote.data;
  return <div className={styles.page}>
    <div><Link className="btn" href={`/atelier/projects/${encodeURIComponent(projectId)}`}>{t('atelierProjects.backToProject')}</Link></div>
    <PageHeader kicker={t('garmentDelivery.factory.name')} title={t('garmentDelivery.checkout.title')} lead={t('garmentDelivery.checkout.lead')} />
    <p className={styles.simulation} role="note">{t('garmentDelivery.simulationNotice')}</p>
    {quote.error && <ErrorState error={quote.error} onRetry={quote.reload} />}
    {!data ? !quote.error && <Skeleton className="h-64" /> : !data.eligible ? <MissingFields projectId={projectId} fields={data.missingFields} /> :
      <div className={styles.layout}>
        <aside className={styles.aside}>
          <GarmentPreview title={data.projectTitle} garment={data.garment} revisionNumber={data.revisionNumber} specDigest={data.specDigest} sizeLabel={data.sizes.selected} />
          <PassportPreview quote={data} />
        </aside>
        <div className={styles.main}>
          <SizeSection quote={data} onSize={size => setDraft({ ...draft, size })} />
          <section className={styles.section}>
            <h2><span className={styles.step}>2</span>{t('garmentDelivery.care.sectionTitle')}</h2>
            <p className={styles.muted}>{t(`garmentDelivery.composition.source.${data.composition.source}`)}</p>
            <CareLabelView care={data.care} composition={data.composition} />
          </section>
          <DeliverySection draft={draft} onChange={setDraft} />
          <SpeedSection value={draft.speed} onChange={speed => setDraft({ ...draft, speed })} />
          <CheckoutSummary quote={data} busy={confirm.busy} error={confirm.error} canConfirm={ready && !!data.delivery && !quote.loading} onConfirm={() => void confirm.run()} />
        </div>
      </div>}
  </div>;
}
