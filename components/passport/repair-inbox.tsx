'use client';
import { useState } from 'react';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { commandKey } from '@/lib/passport/api';
import { repairsApi, type RepairOrder } from '@/lib/passport/repairs';
import { Button, Card, EmptyState, ErrorState, Field, FileButton, Input, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import { RepairBadges, RepairTimeline } from './repair-timeline';

function QuoteForm({ order, busy, onQuote }: { order: RepairOrder; busy: boolean; onQuote: (body: { diagnosis: string; amount: number; currency: string; validUntil: string }) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ diagnosis: order.diagnosis ?? '', amount: '', currency: 'BRL', validUntil: '' });
  return <div className="grid gap-2 sm:grid-cols-4">
    <div className="sm:col-span-4"><Field id={`diag-${order.id}`} label={t('repair.diagnosis')}><Textarea id={`diag-${order.id}`} maxLength={2000} value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} /></Field></div>
    <Field id={`amount-${order.id}`} label={t('repair.amount')}><Input id={`amount-${order.id}`} type="number" min={0} step={0.01} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
    <Field id={`currency-${order.id}`} label={t('sourcing.currency')}><Input id={`currency-${order.id}`} maxLength={3} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Field>
    <Field id={`valid-${order.id}`} label={t('sourcing.validUntilLabel')}><Input id={`valid-${order.id}`} type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} /></Field>
    <div className="flex items-end"><Button variant="primary" loading={busy} disabled={!form.diagnosis.trim() || form.amount === '' || !form.validUntil} onClick={() => onQuote({ diagnosis: form.diagnosis, amount: Number(form.amount), currency: form.currency, validUntil: form.validUntil })}>{t('repair.sendQuote')}</Button></div>
  </div>;
}

function DeliverForm({ order, busy, onDeliver }: { order: RepairOrder; busy: boolean; onDeliver: (body: { serviceSummary: string; providerStatement: string; shareScope: 'PRIVATE' | 'HISTORY_ONLY' }) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ serviceSummary: '', providerStatement: '', shareScope: 'PRIVATE' as 'PRIVATE' | 'HISTORY_ONLY' });
  return <div className="grid gap-2">
    <Field id={`service-${order.id}`} label={t('repair.service')}><Textarea id={`service-${order.id}`} maxLength={2000} value={form.serviceSummary} onChange={e => setForm({ ...form, serviceSummary: e.target.value })} /></Field>
    <Field id={`statement-${order.id}`} label={t('repair.statement')} hint={t('repair.statementHint')}><Textarea id={`statement-${order.id}`} maxLength={2000} value={form.providerStatement} onChange={e => setForm({ ...form, providerStatement: e.target.value })} /></Field>
    <Field id={`scope-${order.id}`} label={t('repair.shareScope')}><Select id={`scope-${order.id}`} value={form.shareScope} onChange={e => setForm({ ...form, shareScope: e.target.value as 'PRIVATE' | 'HISTORY_ONLY' })}><option value="PRIVATE">{t('repair.scope.PRIVATE')}</option><option value="HISTORY_ONLY">{t('repair.scope.HISTORY_ONLY')}</option></Select></Field>
    <div><Button variant="primary" loading={busy} disabled={!form.serviceSummary.trim() || !form.providerStatement.trim()} onClick={() => onDeliver(form)}>{t('repair.deliver')}</Button></div>
  </div>;
}

/** Caixa do prestador: orçar, iniciar, entregar com declaração e anexar o recibo privado. */
export function RepairInbox() {
  const { t, fmtDate } = useI18n(); const toast = useToast();
  const inbox = useApi(signal => repairsApi.inbox(signal), []);
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true);
    try { await action(); inbox.reload(); } catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  if (inbox.error) return <ErrorState error={inbox.error} onRetry={inbox.reload} />;
  if (inbox.loading && !inbox.data) return <Skeleton className="h-32" />;
  const rows = inbox.data ?? [];
  if (rows.length === 0) return <EmptyState title={t('repair.inboxEmpty')} />;
  return <div className="grid gap-3">{rows.map(order => <Card key={order.id}>
    <div className="flex flex-wrap items-center gap-2"><RepairBadges order={order} /><span className="type-caption text-muted">{fmtDate(order.createdAt)}</span></div>
    {order.requestNotes && <p className="type-body-sm">{t('repair.requestNotes')}: {order.requestNotes}</p>}
    <RepairTimeline order={order} busy={busy} onCorrect={(eventId, text) => run(() => repairsApi.correct(order.id, { correctsEventId: eventId, notes: text }))} />
    {['REQUESTED', 'QUOTED'].includes(order.status) && <QuoteForm order={order} busy={busy} onQuote={body => run(() => repairsApi.quote(order.id, { expectedVersion: order.version, ...body }))} />}
    {order.status === 'AUTHORIZED' && <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => repairsApi.start(order.id, order.version))}>{t('repair.start')}</Button>}
    {order.status === 'IN_SERVICE' && <DeliverForm order={order} busy={busy} onDeliver={body => run(() => repairsApi.deliver(order.id, { expectedVersion: order.version, ...body }))} />}
    {order.status === 'DELIVERED' && <FileButton id={`receipt-${order.id}`} accept="image/png,image/jpeg" disabled={busy} onFiles={files => files[0] && run(() => repairsApi.upload(order.id, files[0], commandKey()))}>{t('repair.attachReceipt', { count: order.receipts.length })}</FileButton>}
  </Card>)}</div>;
}
