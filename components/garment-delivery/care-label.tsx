'use client';
import { useI18n } from '@/lib/i18n/i18n';
import { CareIcon, type CareSlot } from './care-icons';
import type { CareLabel as CareLabelData, Composition } from './contracts';
import styles from './garment-delivery.module.css';

const SLOTS: CareSlot[] = ['wash', 'bleach', 'tumble', 'iron', 'dryClean', 'naturalDry'];

/** Composição em texto no idioma de quem lê: "97% algodão, 3% elastano". */
export function useCompositionText() {
  const { t } = useI18n();
  return (composition: Composition) => composition.lines.map(line => `${line.percent}% ${t(`garmentDelivery.fiber.${line.fiber}`)}`).join(', ');
}

/**
 * Etiqueta de cuidados da peça: os seis símbolos (lavagem, alvejante, secadora, ferro, limpeza a seco e secagem
 * natural), o texto de cada um e as dicas de conservação. {@code compact} mostra só os símbolos com legenda curta.
 */
export function CareLabelView({ care, composition, compact = false }: { care: CareLabelData; composition?: Composition; compact?: boolean }) {
  const { t } = useI18n();
  const compositionText = useCompositionText();
  return <figure className={styles.careLabel} aria-label={t('garmentDelivery.care.title')}>
    <div className={styles.careHead}>
      <span className={styles.careBrand}>{t('garmentDelivery.factory.name')}</span>
      {composition && <span className={styles.careComposition}>{compositionText(composition)}</span>}
    </div>
    <ul className={styles.careSymbols}>
      {SLOTS.map(slot => <li key={slot}>
        <CareIcon slot={slot} code={care[slot]} size={compact ? 32 : 40} />
        <span>{t(`garmentDelivery.care.${care[slot]}`)}</span>
      </li>)}
    </ul>
    {!compact && <>
      <p className={styles.careProfile}>{t(`garmentDelivery.profile.${care.profile}`)}</p>
      <ul className={styles.tips}>{care.tips.map(tip => <li key={tip}>{t(`garmentDelivery.tip.${tip}`)}</li>)}</ul>
    </>}
  </figure>;
}
