'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { ApiError } from '@/lib/api/client';
import { passportApi, commandKey } from '@/lib/passport/api';
import type { GarmentPassport, PassportEventKind, PassportField, PassportOrigin, ResaleDraft } from '@/lib/passport/types';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { Button, Field, FileButton, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { PassportTransfers } from './passport-transfers';
import styles from './passport.module.css';

const origins: PassportOrigin[] = ['UNKNOWN', 'COMPRADA', 'GARIMPADA', 'HERDADA', 'PRESENTE', 'FEITA_A_MAO', 'TROCADA'];
const fields: PassportField[] = ['NAME', 'ORIGIN', 'COMPOSITION', 'CARE', 'HISTORY'];
const eventKinds: PassportEventKind[] = ['PURCHASE', 'CARE', 'REPAIR', 'ALTERATION', 'CORRECTION'];

function DeclarationSnapshot({ notes }: { notes: string }) {
  const { t } = useI18n();
  try {
    const snapshot = JSON.parse(notes) as { origin?: PassportOrigin; composition?: string; care?: string };
    return <dl className={styles.details}>{snapshot.origin && <><dt>{t('passport.origin')}</dt><dd>{t(`passport.origin.${snapshot.origin}`)}</dd></>}{snapshot.composition && <><dt>{t('passport.composition')}</dt><dd>{snapshot.composition}</dd></>}{snapshot.care && <><dt>{t('passport.care')}</dt><dd>{snapshot.care}</dd></>}</dl>;
  } catch { return null; }
}

function PassportForm({ data, reload }: { data: GarmentPassport; reload: () => void }) {
  const { t, fmtDate, fmtMoney } = useI18n();
  const [origin, setOrigin] = useState(data.origin); const [composition, setComposition] = useState(data.composition ?? ''); const [care, setCare] = useState(data.care ?? '');
  const [kind, setKind] = useState<PassportEventKind>('CARE'); const [date, setDate] = useState(''); const [notes, setNotes] = useState(''); const [corrects, setCorrects] = useState('');
  const [scope, setScope] = useState<PassportField[]>([]); const [shareHours, setShareHours] = useState('168'); const [shareUrl, setShareUrl] = useState(''); const [qr, setQr] = useState('');
  const [documentKind, setDocumentKind] = useState('PURCHASE_RECEIPT'); const [recipient, setRecipient] = useState(''); const [transferToken, setTransferToken] = useState('');
  const [resale, setResale] = useState<ResaleDraft | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const retryKeys = useRef<Record<string, string>>({});
  useEffect(() => { setOrigin(data.origin); setComposition(data.composition ?? ''); setCare(data.care ?? ''); }, [data.origin, data.composition, data.care]);
  const retryKey = (action: string) => (retryKeys.current[action] ??= commandKey());
  const resetKey = (action: string) => { delete retryKeys.current[action]; };
  async function action(run: () => Promise<void>, refresh = true) {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await run(); if (refresh) reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t('passport.failed')); if (failure instanceof ApiError && failure.status === 409) reload(); }
    finally { setBusy(false); }
  }
  async function download(id: string) {
    const url = await passportApi.document(id); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'passport-evidence.png'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <section className={styles.panel}><h2>{t('passport.declarations')}</h2><p className={styles.note}>{t('passport.declarationsHint')}</p>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); void action(async () => { await passportApi.update(data.id, { version: data.version, origin, composition, care }); setNotice(t('passport.saved')); }); }}>
        <Field id="passport-origin" label={t('passport.origin')}><Select id="passport-origin" value={origin} onChange={event => setOrigin(event.target.value as PassportOrigin)}>{origins.map(value => <option key={value} value={value}>{t(`passport.origin.${value}`)}</option>)}</Select></Field>
        <div className={styles.grid}><Field id="passport-composition" label={t('passport.composition')}><Textarea id="passport-composition" value={composition} maxLength={1000} onChange={event => setComposition(event.target.value)} /></Field>
          <Field id="passport-care" label={t('passport.care')}><Textarea id="passport-care" value={care} maxLength={1000} onChange={event => setCare(event.target.value)} /></Field></div>
        <Button type="submit" loading={busy}>{t('passport.save')}</Button>
      </form>
    </section>
    <section className={styles.panel}><h2>{t('passport.history')}</h2>
      {!data.events.length ? <p className={styles.note}>{t('passport.noEvents')}</p> : <ol className={styles.timeline}>{data.events.map(event => <li key={event.id}><strong>{t(`passport.event.${event.kind}`)}</strong> · {fmtDate(event.occurredOn)}
        <p className={styles.status}>{t('passport.declared')}</p>{event.notes && (event.kind === 'DECLARATION' ? <DeclarationSnapshot notes={event.notes} /> : <p className={styles.details}>{event.notes}</p>)}{event.correctsEventId && <small>{t('passport.correctionRecorded')}</small>}
      </li>)}</ol>}
      <form className={styles.form} onSubmit={event => { event.preventDefault(); void action(async () => {
        await passportApi.event(data.id, { version: data.version, kind, occurredOn: date, notes, ...(kind === 'CORRECTION' ? { correctsEventId: corrects } : {}) }, retryKey('event'));
        resetKey('event'); setNotes(''); setCorrects(''); setNotice(t('passport.eventSaved'));
      }); }}>
        <div className={styles.grid}><Field id="passport-event-kind" label={t('passport.eventType')}><Select id="passport-event-kind" value={kind} onChange={event => { setKind(event.target.value as PassportEventKind); resetKey('event'); }}>{eventKinds.map(value => <option key={value} value={value}>{t(`passport.event.${value}`)}</option>)}</Select></Field>
          <Field id="passport-event-date" label={t('passport.eventDate')}><Input id="passport-event-date" type="date" required value={date} max={new Date().toISOString().slice(0, 10)} onChange={event => { setDate(event.target.value); resetKey('event'); }} /></Field></div>
        {kind === 'CORRECTION' && <Field id="passport-corrects" label={t('passport.corrects')}><Select id="passport-corrects" value={corrects} onChange={event => { setCorrects(event.target.value); resetKey('event'); }}><option value="">{t('passport.chooseEvent')}</option>{data.events.filter(event => event.notes != null).map(event => <option key={event.id} value={event.id}>{t(`passport.event.${event.kind}`)} · {fmtDate(event.occurredOn)}</option>)}</Select></Field>}
        <Field id="passport-event-notes" label={t('passport.privateNotes')}><Textarea id="passport-event-notes" required maxLength={2000} value={notes} onChange={event => { setNotes(event.target.value); resetKey('event'); }} /></Field>
        <Button type="submit" loading={busy} disabled={kind === 'CORRECTION' && !corrects}>{t('passport.addEvent')}</Button>
      </form><p className={styles.note}>{t('passport.noRewards')}</p>
    </section>
    <section className={styles.panel}><h2>{t('passport.evidence')}</h2><p className={styles.note}>{t('passport.evidenceHint')}</p>
      <Field id="passport-document-kind" label={t('passport.documentType')}><Select id="passport-document-kind" value={documentKind} onChange={event => setDocumentKind(event.target.value)}>{['PURCHASE_RECEIPT', 'REPAIR_RECEIPT', 'CARE_LABEL'].map(value => <option key={value} value={value}>{t(`passport.document.${value}`)}</option>)}</Select></Field>
      <FileButton accept="image/png,image/jpeg" loading={busy} disabled={busy} onFiles={files => { const file = files[0]; if (!file) return; void action(async () => {
        if (file.size > 2 * 1024 * 1024) throw new Error(t('passport.imageLimit'));
        await passportApi.upload(data.id, file, documentKind, retryKey(`document:${file.name}:${file.size}:${file.lastModified}`));
        resetKey(`document:${file.name}:${file.size}:${file.lastModified}`); setNotice(t('passport.evidenceUploaded'));
      }); }}>{t('passport.uploadEvidence')}</FileButton>
      {data.evidence.map(document => <div className={styles.document} key={document.id}><span>{t(`passport.document.${document.kind}`)} · {t(document.status === 'EXPIRED' ? 'passport.expired' : 'passport.presented')}</span>
        <small>{t('passport.expires')}: {fmtDate(document.expiresAt)}</small>
        <Button size="sm" disabled={busy || document.status === 'EXPIRED'} onClick={() => void action(() => download(document.id), false)}>{t('passport.download')}</Button>
        <Button size="sm" disabled={busy} onClick={() => void action(async () => { await passportApi.deleteDocument(document.id); })}>{t('passport.delete')}</Button>
      </div>)}
    </section>
    <section className={styles.panel}><h2>{t('passport.sharing')}</h2><p className={styles.note}>{t('passport.sharingHint')}</p>
      <fieldset disabled={busy}><legend>{t('passport.publicFields')}</legend><div className={styles.grid}>{fields.map(field => <label key={field} className={styles.check}><input type="checkbox" checked={scope.includes(field)} onChange={event => setScope(previous => event.target.checked ? [...previous, field] : previous.filter(value => value !== field))} />{t(`passport.field.${field}`)}</label>)}</div></fieldset>
      <Field id="passport-share-expiry" label={t('passport.shareExpiry')}><Input id="passport-share-expiry" type="number" min={1} max={720} value={shareHours} onChange={event => setShareHours(event.target.value)} /></Field>
      <Button loading={busy} disabled={!scope.length} onClick={() => void action(async () => {
        const created = await passportApi.share(data.id, { version: data.version, fields: scope, expiresInHours: Number(shareHours) });
        const url = new URL(created.path, window.location.origin).href; setShareUrl(url);
        try { setQr(await QRCode.toDataURL(url, { width: 256, margin: 4, errorCorrectionLevel: 'M' })); }
        catch { setQr(''); setNotice(t('passport.qrFailed')); }
      })}>{t('passport.createShare')}</Button>
      {shareUrl && <div className={styles.form}><a href={shareUrl} referrerPolicy="no-referrer" className={styles.link}>{shareUrl}</a>{qr && <img src={qr} width={256} height={256} className={styles.qr} alt={t('passport.qrAlt')} />}<p className={styles.note}>{t('passport.tokenOnce')}</p></div>}
      {data.shares.map(share => <div className={styles.document} key={share.id}><span>{share.fields.map(field => t(`passport.field.${field}`)).join(', ')} · {fmtDate(share.expiresAt)}</span><Button size="sm" disabled={busy || share.revoked} onClick={() => void action(async () => { await passportApi.revoke(data.id, share.id); setShareUrl(''); setQr(''); })}>{t(share.revoked ? 'passport.revoked' : 'passport.revoke')}</Button></div>)}
    </section>
    <section className={styles.panel}><h2>{t('passport.resale')}</h2><p className={styles.note}>{t('passport.resaleHint')}</p><Button loading={busy} onClick={() => void action(async () => { setResale(await passportApi.resale(data.id)); }, false)}>{t('passport.prepareResale')}</Button>
      {resale && <article><h3>{resale.title}</h3><p>{t(resale.forSale ? 'passport.forSale' : 'passport.forDonation')}{resale.price != null && resale.forSale ? ` · ${fmtMoney(resale.price, resale.currency)}` : ''}</p><p className={styles.details}>{resale.composition}</p><p className={styles.details}>{resale.care}</p><p>{t('passport.declared')}</p><Link href={`/pieces/${encodeURIComponent(data.pieceId)}?edit=1`} className="btn">{t('passport.editListing')}</Link></article>}
    </section>
    <section className={styles.panel}><h2>{t('passport.transfer')}</h2><p className={styles.note}>{t('passport.transferHint')}</p>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); void action(async () => {
        const result = await passportApi.offer(data.id, { version: data.version, recipientUsername: recipient, expiresInHours: 48 }, retryKey('transfer'));
        resetKey('transfer'); setTransferToken(result.token ?? ''); setNotice(t(result.token ? 'passport.transferCreated' : 'passport.transferRetry'));
      }); }}><Field id="passport-recipient" label={t('passport.recipient')}><Input id="passport-recipient" required value={recipient} maxLength={60} autoComplete="off" onChange={event => { setRecipient(event.target.value); resetKey('transfer'); }} /></Field><Button type="submit" loading={busy}>{t('passport.offerTransfer')}</Button></form>
      {transferToken && <div><p>{t('passport.transferToken')}</p><code className={styles.link}>{transferToken}</code><p className={styles.note}>{t('passport.sendToken')}</p><Link href="/passport-transfers" className="btn">{t('passport.incoming')}</Link></div>}
      {data.transfers.map(transfer => <div key={transfer.id} className={styles.document}><span>{t(`passport.transferStatus.${transfer.status}`)} · {fmtDate(transfer.expiresAt)}</span>{transfer.status === 'PENDING' && <Button size="sm" disabled={busy} onClick={() => void action(async () => { await passportApi.cancel(data.id, transfer.id); setTransferToken(''); })}>{t('passport.cancelTransfer')}</Button>}</div>)}
    </section>
  </>;
}

export function PassportEditor({ pieceId }: { pieceId: string }) {
  const { t } = useI18n(); const query = useApi(signal => passportApi.get(pieceId, signal), [pieceId]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const createKey = useRef<string | null>(null);
  const missing = query.error?.code === 'PASSPORT_NOT_CREATED';
  return <main className={styles.page}>
    <header className={styles.header}><Link className="btn" href={`/pieces/${encodeURIComponent(pieceId)}`}>{t('passport.back')}</Link><p className={styles.status}>{t('passport.privateLabel')}</p><h1>{query.data?.pieceName ?? t('passport.title')}</h1><p>{t('passport.hint')}</p><p className={styles.note}>{t('passport.identityLimit')}</p></header>
    {query.error ? missing ? <section className={styles.panel}><p>{t('passport.notCreated')}</p>{error && <p role="alert">{error}</p>}<Button loading={busy} onClick={async () => {
      setBusy(true); setError(''); createKey.current ??= commandKey();
      try { query.setData(await passportApi.create(pieceId, createKey.current)); createKey.current = null; query.reload(); }
      catch (failure) { setError(failure instanceof Error ? failure.message : t('passport.failed')); }
      finally { setBusy(false); }
    }}>{t('passport.create')}</Button></section> : <p role="alert">{query.error.message}</p> : query.data?.pieceId === pieceId ? <PassportForm key={query.data.id} data={query.data} reload={query.reload} /> : query.loading ? <Skeleton className="h-64" /> : null}
    <PassportTransfers />
  </main>;
}
