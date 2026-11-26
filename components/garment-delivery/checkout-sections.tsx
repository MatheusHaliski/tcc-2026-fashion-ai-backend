'use client';
import Link from 'next/link';
import { mediaUrl } from '@/lib/api/client';
import { useI18n } from '@/lib/i18n/i18n';
import { label, subcategoryLabel } from '@/lib/api/taxonomy';
import { shortDigest, type Designer, type Garment, type Measure, type Quote } from './contracts';
import styles from './garment-delivery.module.css';

/** Prévia da peça: imagem do tipo de peça, amostra da cor da ficha, revisão de origem e digest da ficha. */
export function GarmentPreview({ title, garment, revisionNumber, specDigest, sizeLabel }: { title: string; garment: Garment; revisionNumber: number; specDigest: string; sizeLabel?: string | null }) {
  const { t } = useI18n();
  return <section className={styles.preview} aria-label={t('garmentDelivery.preview.title')}>
    <p className={styles.kicker}>{t('garmentDelivery.preview.kicker')}</p>
    <div className={styles.garment}>
      {garment.imageUrl && <img src={mediaUrl(garment.imageUrl)} alt={subcategoryLabel(garment.subcategory)} />}
      <span className={styles.swatch}><i style={{ background: garment.colorHex ?? 'transparent' }} />{label(garment.colorCode)}</span>
    </div>
    <h2 className={styles.title}>{title}</h2>
    <dl className={styles.facts}>
      <dt>{t('garmentDelivery.preview.type')}</dt><dd>{subcategoryLabel(garment.subcategory)}</dd>
      <dt>{t('garmentDelivery.preview.material')}</dt><dd>{label(garment.materialCode)}</dd>
      {sizeLabel && <><dt>{t('garmentDelivery.preview.size')}</dt><dd>{sizeLabel}</dd></>}
      <dt>{t('garmentDelivery.preview.revision')}</dt><dd>{t('garmentDelivery.preview.revisionValue', { number: revisionNumber })}</dd>
      <dt>{t('garmentDelivery.preview.digest')}</dt><dd className={styles.mono} title={specDigest}>{shortDigest(specDigest)}</dd>
    </dl>
  </section>;
}

export function MeasuresTable({ measures, showChecked }: { measures: Measure[]; showChecked?: boolean }) {
  const { t, fmtNumber } = useI18n();
  const cm = (value: number) => t('garmentDelivery.cm', { value: fmtNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
  if (!measures.length) return <p className={styles.muted}>{t('garmentDelivery.measures.none')}</p>;
  return <div style={{ overflowX: 'auto' }}><table className={styles.measures}>
    <thead><tr><th>{t('garmentDelivery.measures.point')}</th><th>{t('garmentDelivery.measures.value')}</th><th>{t('garmentDelivery.measures.tolerance')}</th>{showChecked && <th>{t('garmentDelivery.measures.checked')}</th>}</tr></thead>
    <tbody>{measures.map(m => <tr key={m.point}><td>{m.point}</td><td>{cm(m.value)}</td><td>±{fmtNumber(m.tolerance, { minimumFractionDigits: 1 })}</td>{showChecked && <td>{m.checked == null ? '—' : cm(m.checked)}</td>}</tr>)}</tbody>
  </table></div>;
}

/** Tamanho: grade do SizeOptionsService; o preço não muda com o tamanho. */
export function SizeSection({ quote, onSize }: { quote: Quote; onSize: (size: string) => void }) {
  const { t } = useI18n();
  return <section className={styles.section}>
    <h2><span className={styles.step}>1</span>{t('garmentDelivery.size.title')}</h2>
    <div className={styles.sizes} role="group" aria-label={t('garmentDelivery.size.title')}>
      {quote.sizes.labels.map(size => <button key={size} type="button" className={styles.size} aria-pressed={quote.sizes.selected === size} onClick={() => onSize(size)}>{size}</button>)}
    </div>
    <p className={styles.muted}>{t('garmentDelivery.size.hint', { base: quote.sizes.base ?? '—' })}</p>
    <MeasuresTable measures={quote.measurements} />
  </section>;
}

export function designerRole(t: (key: string) => string, designer: Designer) {
  return `${designer.username ?? '—'} · ${t(`garmentDelivery.designer.${designer.role}`)}`;
}

/** Prévia do passaporte: o que a peça vai carregar quando chegar (série e lote nascem na confirmação). */
export function PassportPreview({ quote }: { quote: Quote }) {
  const { t } = useI18n();
  return <section className={styles.passport} aria-label={t('garmentDelivery.passport.preview')}>
    <div className={styles.passportHead}><strong>{t('garmentDelivery.passport.preview')}</strong><span className={styles.kicker}>{quote.factoryCode}</span></div>
    <dl className={styles.facts}>
      <dt>{t('garmentDelivery.passport.serial')}</dt><dd className={styles.mono}>{t('garmentDelivery.passport.serialPending')}</dd>
      <dt>{t('garmentDelivery.passport.origin')}</dt><dd>{t('passport.origin.SOB_ENCOMENDA')}</dd>
      <dt>{t('garmentDelivery.passport.factory')}</dt><dd>{t('garmentDelivery.factory.name')} · {t('garmentDelivery.factory.place')}</dd>
      <dt>{t('garmentDelivery.passport.designers')}</dt><dd>{quote.designers.map(d => designerRole(t, d)).join(', ')}</dd>
      <dt>{t('garmentDelivery.passport.events')}</dt><dd>{t('garmentDelivery.passport.eventsHint')}</dd>
    </dl>
  </section>;
}

/** Ficha incompleta: o que falta, com link para completar a ficha no projeto e para o editor 3D. */
export function MissingFields({ projectId, fields }: { projectId: string; fields: string[] }) {
  const { t } = useI18n();
  return <section className={styles.missing} role="alert">
    <h2 className="type-h3">{t('garmentDelivery.missing.title')}</h2>
    <p>{t('garmentDelivery.missing.hint')}</p>
    <ul>{fields.map(field => <li key={field}>{t(`atelierProjects.field.${field}`)}</li>)}</ul>
    <div className={styles.actions}>
      <Link className="btn btn-primary" href={`/atelier/projects/${encodeURIComponent(projectId)}`}>{t('garmentDelivery.missing.complete')}</Link>
      <Link className="btn" href={`/atelier/projects/${encodeURIComponent(projectId)}/editor`}>{t('atelier3d.openEditor')}</Link>
    </div>
  </section>;
}
