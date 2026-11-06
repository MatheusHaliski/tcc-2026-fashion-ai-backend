'use client';
import { useRef, useState } from 'react';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { commandKey, passportApi } from '@/lib/passport/api';
import { repairsApi, type RepairOrder } from '@/lib/passport/repairs';
import { Button, Card, EmptyState, ErrorState, Field, Input, Skeleton, Textarea, useToast } from '@/components/ui';
import { RepairBadges, RepairTimeline } from './repair-timeline';

async function openReceipt(id: string) {
  const url = await repairsApi.receipt(id); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'repair-receipt.png'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RF-PESQ-05 — lado do proprietário: pede o conserto, autoriza o orçamento, revoga o acesso do prestador. */
export function RepairOrdersPanel({ pieceId }: { pieceId: string }) {
  const { t, fmtDate, fmtMoney } = useI18n(); const toast = useToast();
  const passport = useApi(signal => passportApi.get(pieceId, signal), [pieceId]);
  const passportId = passport.data?.id;
  const orders = useApi(signal => passportId ? repairsApi.forPassport(passportId, signal) : Promise.resolve([]), [passportId]);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState(''); const [notes, setNotes] = useState('');
  const key = useRef(commandKey());
  async function run(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true);
    try { await action(); orders.reload(); } catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  if (passport.error) return <ErrorState error={passport.error} onRetry={passport.reload} />;
  if (!passport.data) return <Skeleton className="h-40" />;
  return <div className="grid gap-4">
    <Card><h2 className="type-h3">{t('repair.requestTitle')}</h2><p className="type-body-sm text-muted">{t('repair.requestHint')}</p>
      <Field id="repair-provider" label={t('repair.provider')}><Input id="repair-provider" maxLength={80} value={provider} onChange={e => setProvider(e.target.value)} /></Field>
      <Field id="repair-notes" label={t('repair.requestNotes')}><Textarea id="repair-notes" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      <Button variant="primary" loading={busy} disabled={!provider.trim()} onClick={() => run(async () => { await repairsApi.request(passportId!, { providerUsername: provider, notes, commandKey: key.current }); key.current = commandKey(); setProvider(''); setNotes(''); })}>{t('repair.send')}</Button>
    </Card>
    {orders.loading && !orders.data ? <Skeleton className="h-24" /> : (orders.data ?? []).length === 0 ? <EmptyState title={t('repair.none')} /> : (orders.data ?? []).map((order: RepairOrder) => <Card key={order.id}>
      <div className="flex flex-wrap items-center gap-2"><b>{order.providerName ?? order.providerId}</b><RepairBadges order={order} /><span className="type-caption text-muted">{fmtDate(order.createdAt)}</span></div>
      {order.diagnosis && <p className="type-body-sm">{t('repair.diagnosis')}: {order.diagnosis}</p>}
      {order.quoteAmount != null && <p className="type-body-sm">{t('repair.quote')}: {fmtMoney(order.quoteAmount, order.quoteCurrency ?? 'BRL')}{order.quoteValidUntil ? ` · ${t('repair.validUntil', { date: fmtDate(order.quoteValidUntil) })}` : ''}</p>}
      {order.serviceSummary && <p className="type-body-sm">{t('repair.service')}: {order.serviceSummary}</p>}
      {order.providerStatement && <p className="type-body-sm">{t('repair.statement')}: {order.providerStatement} <span className="text-muted">({t('repair.providerDeclaredLong')})</span></p>}
      <RepairTimeline order={order} busy={busy} onCorrect={(eventId, text) => run(() => repairsApi.correct(order.id, { correctsEventId: eventId, notes: text }))} />
      <div className="flex flex-wrap gap-2">
        {order.status === 'QUOTED' && <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => repairsApi.authorize(order.id, order.version))}>{t('repair.authorize')}</Button>}
        {['REQUESTED', 'QUOTED', 'AUTHORIZED'].includes(order.status) && <Button size="sm" disabled={busy} onClick={() => run(() => repairsApi.cancel(order.id, order.version))}>{t('common.cancel')}</Button>}
        {!order.accessRevoked && <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => repairsApi.revoke(order.id))}>{t('repair.revoke')}</Button>}
        {order.receipts.map(receipt => <Button key={receipt.id} size="sm" disabled={busy} onClick={() => void openReceipt(receipt.id)}>{t('repair.receipt', { date: fmtDate(receipt.createdAt) })}</Button>)}
      </div>
      <p className="type-caption text-muted">{t('repair.privateReceiptHint')}</p>
    </Card>)}
  </div>;
}
