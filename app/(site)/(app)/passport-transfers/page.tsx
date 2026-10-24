'use client';
import { PassportTransfers } from '@/components/passport/passport-transfers';
import { useI18n } from '@/lib/i18n/i18n';
import styles from '@/components/passport/passport.module.css';
export default function PassportTransfersPage() {
  const { t } = useI18n();
  return <main className={styles.page}><h1>{t('passport.incoming')}</h1><PassportTransfers /></main>;
}
