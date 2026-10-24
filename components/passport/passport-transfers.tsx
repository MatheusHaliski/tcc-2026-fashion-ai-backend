'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { passportApi, commandKey } from '@/lib/passport/api';
import type { PassportTransfer } from '@/lib/passport/types';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { Button, Field, Input, Skeleton } from '@/components/ui';
import styles from './passport.module.css';

function TransferAcceptance({ transfer, onAccepted }: { transfer: PassportTransfer; onAccepted: (value: PassportTransfer) => void }) {
  const { t, fmtDate } = useI18n(); const [token, setToken] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const retryKey = useRef<string | null>(null);
  return <form className={styles.panel} onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(''); retryKey.current ??= commandKey();
    try { const accepted = await passportApi.accept(transfer.id, { version: transfer.version, token }, retryKey.current); retryKey.current = null; onAccepted(accepted); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t('passport.failed')); }
    finally { setBusy(false); }
  }}>
    <p>{t('passport.transferWaiting')} · {fmtDate(transfer.expiresAt)}</p><p className={styles.note}>{t('passport.acceptHint')}</p>
    <Field id={`passport-token-${transfer.id}`} label={t('passport.transferToken')}><Input id={`passport-token-${transfer.id}`} required value={token} onChange={event => { setToken(event.target.value); retryKey.current = null; }} autoComplete="off" minLength={43} maxLength={43} /></Field>
    {error && <p role="alert">{error}</p>}
    <Button type="submit" loading={busy} disabled={transfer.status !== 'PENDING' || token.length !== 43}>{t('passport.accept')}</Button>
  </form>;
}
export function PassportTransfers() {
  const { t } = useI18n(); const query = useApi(signal => passportApi.incoming(signal), []);
  const [accepted, setAccepted] = useState<PassportTransfer | null>(null);
  return <section className={styles.panel}><h2>{t('passport.incoming')}</h2>
    {query.loading ? <Skeleton className="h-24" /> : query.error ? <p role="alert">{query.error.message}</p> : <>
      {accepted?.recipientPieceId && <Link className="btn" href={`/pieces/${encodeURIComponent(accepted.recipientPieceId)}/passport`}>{t('passport.openTransferred')}</Link>}
      {!query.data?.length && <p className={styles.note}>{t('passport.noIncoming')}</p>}
      {query.data?.map(transfer => <TransferAcceptance key={transfer.id} transfer={transfer} onAccepted={value => { setAccepted(value); query.reload(); }} />)}
    </>}
  </section>;
}
