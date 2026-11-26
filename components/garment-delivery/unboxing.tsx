'use client';
import Link from 'next/link';
import { Dialog } from '@/components/ui';
import { mediaUrl } from '@/lib/api/client';
import { useI18n } from '@/lib/i18n/i18n';
import { CareLabelView } from './care-label';
import type { OrderDetail } from './contracts';
import styles from './order-tracker.module.css';

/** Atalhos da peça recebida: a peça no guarda-roupa, o passaporte e o ACERVO. */
export function ReceivedLinks({ pieceId }: { pieceId: string }) {
  const { t } = useI18n();
  const piece = `/pieces/${encodeURIComponent(pieceId)}`;
  return <div className={styles.unboxActions}>
    <Link className="btn btn-primary" href={piece}>{t('garmentDelivery.unboxing.piece')}</Link>
    <Link className="btn" href={`${piece}/passport`}>{t('garmentDelivery.unboxing.passport')}</Link>
    <Link className="btn" href="/acervo">{t('garmentDelivery.unboxing.acervo')}</Link>
  </div>;
}

/** O momento de abrir a caixa: a peça sobe da caixa com o número de série e a etiqueta de cuidados. */
export function Unboxing({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return <Dialog open={open} onClose={onClose} title={t('garmentDelivery.unboxing.title')} size="lg">
    <div className={styles.unboxing}>
      <div className={styles.box} aria-hidden="true">
        <div className={styles.card}>{order.garment.imageUrl && <img src={mediaUrl(order.garment.imageUrl)} alt="" />}</div>
        <div className={styles.tissue} />
        <div className={styles.boxBody} />
        <div className={styles.boxLid} />
      </div>
      <h3 className="type-h2">{order.projectTitle}</h3>
      <p className={styles.unboxSerial}>{order.serialNumber} · {t('garmentDelivery.lot', { lot: order.lotCode })} · {order.sizeLabel}</p>
      <p>{t('garmentDelivery.unboxing.lead')}</p>
      <CareLabelView care={order.care} composition={order.composition} compact />
      {order.pieceId && <ReceivedLinks pieceId={order.pieceId} />}
    </div>
  </Dialog>;
}
