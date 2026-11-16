'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { useAction, useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { garmentOrderApi } from './api';
import { CareLabelView } from './care-label';
import { GarmentPreview, MeasuresTable, designerRole } from './checkout-sections';
import type { OrderDetail } from './contracts';
import { OrderProgress, OrderTimeline } from './order-timeline';
import { ReceivedLinks, Unboxing } from './unboxing';
import gd from './garment-delivery.module.css';
import styles from './order-tracker.module.css';

/** Página de acompanhamento: atualiza sozinha (a cada 4 s na demonstração, a cada minuto no padrão). */
export function OrderTracker({ id }: { id: string }) {
  const { t } = useI18n();
  const [demo, setDemo] = useState(true);
  const query = useApi(async signal => {
    const order = await garmentOrderApi.get(id, signal);
    setDemo(order.speed === 'DEMO');
    return order;
  }, [id], { refreshInterval: demo ? 4000 : 60000 });
  const [unboxing, setUnboxing] = useState(false);
  const action = useAction(async (run: (order: OrderDetail) => Promise<OrderDetail>, order: OrderDetail) => {
    try {
      const next = await run(order);
      query.setData(next);
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) query.reload();
      throw error;
    }
  });
  const order = query.data;
  if (!order) return query.error ? <ErrorState error={query.error} onRetry={query.reload} /> : <Skeleton className="h-64" />;
  const receive = async () => {
    const next = await action.run(o => garmentOrderApi.receive(o.id, o.version), order);
    if (next?.pieceId) setUnboxing(true);
  };
  return <div className={gd.page}>
    <div><Link className="btn" href="/atelier/orders">{t('garmentDelivery.backToOrders')}</Link></div>
    <PageHeader kicker={t('garmentDelivery.factory.name')} title={order.projectTitle} lead={t('garmentDelivery.tracker.lead')} />
    <p className={gd.simulation} role="note">{t('garmentDelivery.simulationNotice')}</p>
    <OrderProgress order={order} />
    {action.error && <ErrorState error={action.error} />}
    <div className={styles.layout}>
      <section className={gd.section}>
        <h2>{t('garmentDelivery.timeline.title')}</h2>
        <OrderTimeline steps={order.timeline} />
        <div className={gd.actions}>
          {order.receivable && <Button variant="primary" size="lg" loading={action.busy} onClick={() => void receive()}>{t('garmentDelivery.receive')}</Button>}
          {order.cancellable && <Button loading={action.busy} onClick={() => void action.run(o => garmentOrderApi.cancel(o.id, o.version), order)}>{t('garmentDelivery.cancel')}</Button>}
        </div>
        {order.cancellable && <p className={gd.muted}>{t('garmentDelivery.cancelHint')}</p>}
        {order.status === 'RECEIVED' && order.pieceId && <><p>{t('garmentDelivery.receivedHint')}</p><ReceivedLinks pieceId={order.pieceId} /></>}
      </section>
      <aside className={styles.side}>
        <GarmentPreview title={order.projectTitle} garment={order.garment} revisionNumber={order.revisionNumber} specDigest={order.specDigest} sizeLabel={order.sizeLabel} />
        <OrderFacts order={order} />
        <CareLabelView care={order.care} composition={order.composition} />
      </aside>
    </div>
    <Unboxing order={order} open={unboxing} onClose={() => setUnboxing(false)} />
  </div>;
}

function OrderFacts({ order }: { order: OrderDetail }) {
  const { t, fmtMoney } = useI18n();
  return <Card>
    <dl className={gd.facts}>
      <dt>{t('garmentDelivery.passport.serial')}</dt><dd className={gd.mono}>{order.serialNumber}</dd>
      <dt>{t('garmentDelivery.passport.lot')}</dt><dd className={gd.mono}>{order.lotCode}</dd>
      <dt>{t('garmentDelivery.passport.factory')}</dt><dd>{t('garmentDelivery.factory.name')} · {t('garmentDelivery.factory.place')}</dd>
      <dt>{t('garmentDelivery.passport.designers')}</dt><dd>{order.designers.map(d => designerRole(t, d)).join(', ')}</dd>
      <dt>{t('garmentDelivery.delivery.title')}</dt><dd>{order.delivery.cepMasked}{order.delivery.label ? ` · ${order.delivery.label}` : ''}</dd>
      <dt>{t('garmentDelivery.summary.total')}</dt><dd>{fmtMoney(order.price.total, order.price.currency)} · {t('garmentDelivery.notCharged')}</dd>
    </dl>
    <h3 className="type-h3" style={{ marginTop: '1rem' }}>{t('garmentDelivery.measures.title')}</h3>
    <MeasuresTable measures={order.measurements} showChecked />
  </Card>;
}
