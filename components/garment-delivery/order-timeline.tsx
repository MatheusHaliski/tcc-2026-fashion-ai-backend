'use client';
import { useI18n } from '@/lib/i18n/i18n';
import type { OrderDetail, TimelineStep } from './contracts';
import styles from './order-tracker.module.css';

/** Linha do tempo das etapas da Fábrica FashionAI: cada etapa diz o que a fábrica faz e quando aconteceu (ou acontece). */
export function OrderTimeline({ steps }: { steps: TimelineStep[] }) {
  const { t, fmtDateTime } = useI18n();
  return <ol className={styles.timeline} aria-label={t('garmentDelivery.timeline.title')}>
    {steps.map((step, index) => <li key={step.stage} className={styles.item} data-state={step.state} aria-current={step.state === 'CURRENT' ? 'step' : undefined}>
      <span className={styles.dot} aria-hidden="true">{step.state === 'DONE' ? '✓' : index + 1}</span>
      <div className={styles.body}>
        <h3>{t(`garmentDelivery.stage.${step.stage}`)}</h3>
        <p>{t(`garmentDelivery.stage.${step.stage}.what`)}</p>
        <span className={styles.when}>{when(t, fmtDateTime, step)}</span>
      </div>
    </li>)}
  </ol>;
}

function when(t: (key: string, args?: Record<string, unknown>) => string, fmt: (d?: string | null) => string, step: TimelineStep) {
  if (step.state === 'SKIPPED') return t('garmentDelivery.timeline.skipped');
  if (step.occurredAt) return t('garmentDelivery.timeline.done', { date: fmt(step.occurredAt) });
  if (step.plannedAt) return t('garmentDelivery.timeline.planned', { date: fmt(step.plannedAt) });
  return t('garmentDelivery.timeline.yourTurn');
}

/** Faixa de progresso com o estado atual, a previsão de entrega e o rastreio (a partir da expedição). */
export function OrderProgress({ order }: { order: OrderDetail }) {
  const { t, fmtDateTime } = useI18n();
  const percent = Math.round(order.progress * 100);
  const closed = order.status === 'RECEIVED' || order.status === 'DELIVERED';
  return <section className={`${styles.hero} ${order.status === 'CANCELLED' ? styles.cancelled : ''} ${closed ? styles.done : ''}`}>
    <div className={styles.heroTop}>
      <h2 className={styles.status}>{t(`garmentDelivery.stage.${order.status}`)}</h2>
      <span className={styles.serial}>{order.serialNumber}</span>
    </div>
    <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('garmentDelivery.progress')}>
      <span className={styles.fill} style={{ width: `${percent}%` }} />
    </div>
    <div className={styles.meta}>
      <span>{t('garmentDelivery.progressValue', { percent })}</span>
      {order.status !== 'CANCELLED' && <span>{t('garmentDelivery.eta')} <strong>{fmtDateTime(order.estimatedDelivery)}</strong></span>}
      {order.trackingCode && <span>{t('garmentDelivery.tracking')} <strong className={styles.serial}>{order.trackingCode}</strong></span>}
      {order.speed === 'DEMO' && <span>{t('garmentDelivery.speed.demoTag')}</span>}
    </div>
  </section>;
}
