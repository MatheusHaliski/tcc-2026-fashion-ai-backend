'use client';
import { Button, ErrorState, Field, Input } from '@/components/ui';
import type { ApiError } from '@/lib/api/client';
import { useI18n } from '@/lib/i18n/i18n';
import { maskCep, onlyDigits, type OrderDraft, type OrderSpeed, type Quote } from './contracts';
import styles from './garment-delivery.module.css';

/** Entrega fictícia com dado mínimo: só CEP e apelido opcional; nenhuma peça física é enviada. */
export function DeliverySection({ draft, onChange }: { draft: OrderDraft; onChange: (draft: OrderDraft) => void }) {
  const { t } = useI18n();
  const cep = onlyDigits(draft.cep);
  return <section className={styles.section}>
    <h2><span className={styles.step}>3</span>{t('garmentDelivery.delivery.title')}</h2>
    <div className={styles.formGrid}>
      <Field id="gd-cep" label={t('garmentDelivery.delivery.cep')} hint={t('garmentDelivery.delivery.cepHint')} error={cep.length > 0 && cep.length < 8 ? t('garmentDelivery.delivery.cepIncomplete') : undefined}>
        <Input id="gd-cep" inputMode="numeric" autoComplete="postal-code" maxLength={9} value={maskCep(draft.cep)} onChange={e => onChange({ ...draft, cep: onlyDigits(e.target.value) })} />
      </Field>
      <Field id="gd-label" label={t('garmentDelivery.delivery.label')} hint={t('garmentDelivery.delivery.labelHint')}>
        <Input id="gd-label" maxLength={40} autoComplete="off" value={draft.deliveryLabel} onChange={e => onChange({ ...draft, deliveryLabel: e.target.value })} />
      </Field>
    </div>
    <p className={styles.muted}>{t('garmentDelivery.delivery.privacy')}</p>
  </section>;
}

export function SpeedSection({ value, onChange }: { value: OrderSpeed; onChange: (speed: OrderSpeed) => void }) {
  const { t } = useI18n();
  return <section className={styles.section}>
    <h2><span className={styles.step}>4</span>{t('garmentDelivery.speed.title')}</h2>
    <div className={styles.speeds} role="group" aria-label={t('garmentDelivery.speed.title')}>
      {(['STANDARD', 'DEMO'] as const).map(speed => <button key={speed} type="button" className={styles.speed} aria-pressed={value === speed} onClick={() => onChange(speed)}>
        {speed === 'DEMO' && <em className={styles.demoTag}>{t('garmentDelivery.speed.demoTag')}</em>}
        <strong>{t(`garmentDelivery.speed.${speed}`)}</strong>
        <span>{t(`garmentDelivery.speed.${speed}.hint`)}</span>
      </button>)}
    </div>
  </section>;
}

/** Preço fictício, prazo e o botão de confirmar (simulação, sem cobrança). */
export function CheckoutSummary({ quote, busy, error, canConfirm, onConfirm }: { quote: Quote; busy: boolean; error: ApiError | null; canConfirm: boolean; onConfirm: () => void }) {
  const { t, fmtMoney, fmtDateTime } = useI18n();
  const money = (value: number | null) => value == null ? '—' : fmtMoney(value, quote.price.currency);
  return <section className={styles.section} aria-label={t('garmentDelivery.summary.title')}>
    <h2><span className={styles.step}>5</span>{t('garmentDelivery.summary.title')}</h2>
    <div className={styles.price}>
      <div><span>{t('garmentDelivery.summary.garment')}</span><span>{money(quote.price.garment)}</span></div>
      <div className={styles.muted}><span>{t('garmentDelivery.summary.factors', { base: money(quote.price.base), fabric: quote.price.fabricFactor, complexity: t(`garmentDelivery.complexity.${quote.price.complexity}`) })}</span></div>
      <div><span>{t('garmentDelivery.summary.shipping')}{quote.delivery ? ` · ${t(`garmentDelivery.region.${quote.delivery.region}`)}` : ''}</span><span>{quote.delivery ? money(quote.price.shipping) : t('garmentDelivery.summary.needCep')}</span></div>
      <div className={styles.total}><span>{t('garmentDelivery.summary.total')}</span><span>{money(quote.price.total)}</span></div>
    </div>
    <p>{t('garmentDelivery.summary.eta', { date: fmtDateTime(quote.estimatedDelivery) })}{quote.speed === 'DEMO' ? ` · ${t('garmentDelivery.speed.demoTag')}` : ''}</p>
    <p className={styles.muted}>{t('garmentDelivery.summary.sizeFree')}</p>
    <div className={styles.confirm}>
      {error && <ErrorState error={error} />}
      <Button variant="primary" size="lg" loading={busy} disabled={!canConfirm} onClick={onConfirm}>{t('garmentDelivery.confirm')}</Button>
      <p className={styles.muted}>{t('garmentDelivery.noPayment')}</p>
    </div>
  </section>;
}
