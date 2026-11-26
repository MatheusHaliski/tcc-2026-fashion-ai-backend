'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/i18n';
import type { ManufacturingRecord } from '@/lib/passport/types';
import { CareLabelView } from './care-label';
import { MeasuresTable, designerRole } from './checkout-sections';
import { shortDigest, type CareLabel, type CompositionLine, type Designer, type Measure } from './contracts';
import styles from './garment-delivery.module.css';

const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : null);

/**
 * Registro de fabricação do passaporte (Fábrica FashionAI, fictícia): série, lote, fábrica, revisão de origem com o
 * digest da ficha, designers, tamanho, medidas conferidas, etiqueta de cuidados e rastreio. No link público chegam só
 * os campos permitidos (sem designers nem rastreio).
 */
export function ManufacturingRecordView({ record, owner = false }: { record: ManufacturingRecord; owner?: boolean }) {
  const { t, fmtDateTime } = useI18n();
  const designers = Array.isArray(record.designers) ? record.designers as Designer[] : [];
  const measures = Array.isArray(record.measurements) ? record.measurements as Measure[] : [];
  const composition = Array.isArray(record.composition) ? record.composition as CompositionLine[] : null;
  const care = record.care && typeof record.care === 'object' ? record.care as CareLabel : null;
  const digest = text(record.specDigest);
  return <section className={styles.passport} aria-label={t('garmentDelivery.record.title')}>
    <div className={styles.passportHead}><strong>{t('garmentDelivery.record.title')}</strong><span className={styles.kicker}>{t('passport.systemRecorded')}</span></div>
    <dl className={styles.facts}>
      <dt>{t('garmentDelivery.passport.serial')}</dt><dd className={styles.mono}>{text(record.serialNumber)}</dd>
      <dt>{t('garmentDelivery.passport.lot')}</dt><dd className={styles.mono}>{text(record.lotCode)}</dd>
      <dt>{t('garmentDelivery.passport.factory')}</dt><dd>{t('garmentDelivery.factory.name')} · {t('garmentDelivery.factory.place')} ({text(record.factoryCode)})</dd>
      {text(record.projectTitle) && <><dt>{t('garmentDelivery.record.project')}</dt><dd>{owner && text(record.projectId) ? <Link href={`/atelier/projects/${text(record.projectId)}`}>{text(record.projectTitle)}</Link> : text(record.projectTitle)}</dd></>}
      <dt>{t('garmentDelivery.preview.revision')}</dt><dd>{t('garmentDelivery.preview.revisionValue', { number: text(record.revisionNumber) ?? '—' })}{digest ? ` · ${shortDigest(digest)}` : ''}</dd>
      {designers.length > 0 && <><dt>{t('garmentDelivery.passport.designers')}</dt><dd>{designers.map(d => designerRole(t, d)).join(', ')}</dd></>}
      <dt>{t('garmentDelivery.preview.size')}</dt><dd>{text(record.sizeLabel)}</dd>
      {text(record.producedAt) && <><dt>{t('garmentDelivery.record.producedAt')}</dt><dd>{fmtDateTime(text(record.producedAt))}</dd></>}
      {text(record.trackingCode) && <><dt>{t('garmentDelivery.passport.tracking')}</dt><dd className={styles.mono}>{text(record.trackingCode)}</dd></>}
      {owner && text(record.orderId) && <><dt>{t('garmentDelivery.record.order')}</dt><dd><Link href={`/atelier/orders/${text(record.orderId)}`}>{t('garmentDelivery.orders.open')}</Link></dd></>}
    </dl>
    {measures.length > 0 && <MeasuresTable measures={measures} showChecked />}
    {care && <CareLabelView care={care} composition={composition ? { lines: composition, source: 'BOM' } : undefined} />}
  </section>;
}
