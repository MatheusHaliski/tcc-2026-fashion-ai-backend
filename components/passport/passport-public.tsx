'use client';
import { useEffect, useState } from 'react';
import { passportApi } from '@/lib/passport/api';
import type { PublicPassport } from '@/lib/passport/types';
import { useI18n } from '@/lib/i18n/i18n';
import { Skeleton } from '@/components/ui';
import styles from './passport.module.css';

export function PassportPublic({ token }: { token: string }) {
  const { t, fmtDate } = useI18n();
  const [data, setData] = useState<PublicPassport | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(false);
    passportApi.public(token, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [token]);
  return <main className={styles.page}>
    <header className={styles.header}><p className={styles.status}>{t('passport.publicLabel')}</p><h1>{data?.pieceName ?? t('passport.title')}</h1></header>
    <p className={styles.note}>{t('passport.publicDisclaimer')}</p>
    {error ? <p role="alert">{t('passport.unavailable')}</p> : !data ? <Skeleton className="h-40" /> : <>
      <section className={styles.panel}><h2>{t('passport.declarations')}</h2><p>{t('passport.declared')}</p>
        {data.origin && <p><strong>{t('passport.origin')}: </strong>{t(`passport.origin.${data.origin}`)}</p>}
        {data.composition != null && <p className={styles.details}><strong>{t('passport.composition')}: </strong>{data.composition}</p>}
        {data.care != null && <p className={styles.details}><strong>{t('passport.care')}: </strong>{data.care}</p>}
        <p className={styles.note}>{t('passport.expires')}: {fmtDate(data.expiresAt)}</p>
      </section>
      {data.events && <section className={styles.panel}><h2>{t('passport.history')}</h2><ol className={styles.timeline}>{data.events.map((event, index) => <li key={`${event.kind}-${event.occurredOn}-${index}`}><strong>{t(`passport.event.${event.kind}`)}</strong><p>{fmtDate(event.occurredOn)}</p><small>{t('passport.declared')}</small></li>)}</ol></section>}
    </>}
  </main>;
}
