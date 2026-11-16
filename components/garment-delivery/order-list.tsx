'use client';
import Link from 'next/link';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { mediaUrl } from '@/lib/api/client';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { garmentOrderApi } from './api';
import gd from './garment-delivery.module.css';
import styles from './order-tracker.module.css';

/** "Encomendas" do Atelier: cada encomenda com o estado, o progresso e a previsão de entrega. */
export function OrderList() {
  const { t, fmtDateTime, fmtMoney } = useI18n();
  const query = useApi(signal => garmentOrderApi.list(signal), [], { refreshInterval: 15000 });
  return <div className={gd.page}>
    <div><Link className="btn" href="/atelier">{t('atelierProjects.backToProjects')}</Link></div>
    <PageHeader kicker={t('garmentDelivery.factory.name')} title={t('garmentDelivery.orders.title')} lead={t('garmentDelivery.orders.lead')} />
    <p className={gd.simulation} role="note">{t('garmentDelivery.simulationNotice')}</p>
    {query.error && <ErrorState error={query.error} onRetry={query.reload} />}
    {query.loading && !query.data ? <Skeleton className="h-48" /> : !query.data?.length ? !query.error &&
      <EmptyState title={t('garmentDelivery.orders.empty')} hint={t('garmentDelivery.orders.emptyHint')} action={<Link className="btn btn-primary" href="/atelier">{t('garmentDelivery.orders.goProjects')}</Link>} /> :
      <div className={gd.layout} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))' }}>
        {query.data.map(order => <Card key={order.id}>
          <article className={gd.page} style={{ gap: '.7rem' }}>
            <div className={gd.garment} style={{ aspectRatio: '4 / 3' }}>{order.imageUrl && <img src={mediaUrl(order.imageUrl)} alt="" />}</div>
            <div className={gd.actions}><Badge tone={order.status === 'CANCELLED' ? 'mark' : order.status === 'RECEIVED' ? 'chalk' : 'thread'}>{t(`garmentDelivery.stage.${order.status}`)}</Badge>
              {order.speed === 'DEMO' && <Badge>{t('garmentDelivery.speed.demoTag')}</Badge>}</div>
            <h2 className="type-h3"><Link href={`/atelier/orders/${order.id}`}>{order.projectTitle}</Link></h2>
            <div className={styles.bar} aria-hidden="true"><span className={styles.fill} style={{ width: `${Math.round(order.progress * 100)}%` }} /></div>
            <p className={gd.muted}>{order.serialNumber} · {order.sizeLabel} · {fmtMoney(order.priceTotal, order.currency)}</p>
            <p className={gd.muted}>{t('garmentDelivery.eta')} {fmtDateTime(order.estimatedDelivery)}</p>
            <Link className="btn" href={`/atelier/orders/${order.id}`}>{t('garmentDelivery.orders.open')}</Link>
          </article>
        </Card>)}
      </div>}
  </div>;
}
