'use client';
import { useState } from 'react';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Skeleton, Textarea, useToast } from '@/components/ui';
import type { SupplierRequest } from './sourcing-contracts';
import { sourcingApi } from './sourcing-api';

function QuoteForm({ request, busy, onSubmit }: { request: SupplierRequest; busy: boolean; onSubmit: (draft: { unitPrice: number; sampleCost: number; currency: string; leadTimeDays: number; validUntil: string; notes: string }) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ unitPrice: '', sampleCost: '', leadTimeDays: '30', validUntil: '', notes: '' });
  const valid = Number(form.unitPrice) >= 0 && form.unitPrice !== '' && form.sampleCost !== '' && Number(form.leadTimeDays) > 0 && !!form.validUntil;
  return <div className="grid gap-2 sm:grid-cols-4">
    <Field id={`price-${request.id}`} label={`${t('sourcing.unitPrice')} (${request.currency})`}><Input id={`price-${request.id}`} type="number" min={0} step={0.01} value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} /></Field>
    <Field id={`sample-${request.id}`} label={t('sourcing.sampleCost')}><Input id={`sample-${request.id}`} type="number" min={0} step={0.01} value={form.sampleCost} onChange={e => setForm({ ...form, sampleCost: e.target.value })} /></Field>
    <Field id={`lead-${request.id}`} label={t('sourcing.leadTimeDays')}><Input id={`lead-${request.id}`} type="number" min={1} max={730} value={form.leadTimeDays} onChange={e => setForm({ ...form, leadTimeDays: e.target.value })} /></Field>
    <Field id={`valid-${request.id}`} label={t('sourcing.validUntilLabel')}><Input id={`valid-${request.id}`} type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} /></Field>
    <div className="sm:col-span-3"><Field id={`notes-${request.id}`} label={t('sourcing.notes')}><Textarea id={`notes-${request.id}`} maxLength={2000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field></div>
    <div className="flex items-end"><Button variant="primary" loading={busy} disabled={!valid} onClick={() => onSubmit({ unitPrice: Number(form.unitPrice), sampleCost: Number(form.sampleCost), currency: request.currency, leadTimeDays: Number(form.leadTimeDays), validUntil: form.validUntil, notes: form.notes })}>{t('sourcing.submitQuote')}</Button></div>
  </div>;
}

/** Caixa do fornecedor: só os pedidos endereçados a ele, com a revisão e a BOM concedidas. */
export function QuoteInbox() {
  const { t, fmtDate } = useI18n(); const toast = useToast();
  const inbox = useApi(signal => sourcingApi.inbox(signal), []);
  const [busy, setBusy] = useState(false);
  async function submit(request: SupplierRequest, draft: Parameters<typeof sourcingApi.submitQuote>[1]) {
    if (busy) return; setBusy(true);
    try { await sourcingApi.submitQuote(request.id, draft, crypto.randomUUID()); toast.success(t('sourcing.quoteSent')); inbox.reload(); }
    catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  if (inbox.error) return <ErrorState error={inbox.error} onRetry={inbox.reload} />;
  if (inbox.loading && !inbox.data) return <Skeleton className="h-32" />;
  const rows = inbox.data ?? [];
  if (rows.length === 0) return <EmptyState title={t('sourcing.inboxEmpty')} />;
  return <div className="grid gap-3">{rows.map(request => <Card key={request.id}>
    <div className="flex flex-wrap items-center gap-2"><b>{request.projectTitle ?? t('sourcing.untitled')}</b><Badge tone="thread">{t(`sourcing.status.${request.status}`)}</Badge><span className="type-caption text-muted">{t('sourcing.requestMeta', { number: request.revisionNumber, units: request.totalUnits, currency: request.currency })} · {fmtDate(request.createdAt)}</span></div>
    <p className="type-caption text-muted">{Object.entries(request.sizes).map(([size, qty]) => `${size}: ${qty}`).join(' · ')}</p>
    {request.notes && <p className="type-body-sm">{request.notes}</p>}
    <h3 className="type-h3">{t('sourcing.bomShort')}</h3>
    {request.bom.length === 0 ? <p className="type-body-sm text-muted">{t('sourcing.bomEmpty')}</p> : <ul className="grid gap-1 type-body-sm">{request.bom.map(row => <li key={row.id}>{t(`sourcing.kind.${row.kind}`)} · {row.name} · {row.quantity} {row.unit}</li>)}</ul>}
    {request.quotes.length > 0 && <p className="type-caption text-muted">{t('sourcing.alreadyQuoted', { count: request.quotes.length })}</p>}
    {['OPEN', 'QUOTED'].includes(request.status) && <QuoteForm request={request} busy={busy} onSubmit={draft => void submit(request, draft)} />}
    <p className="type-caption text-muted">{t('sourcing.noCommitment')}</p>
  </Card>)}</div>;
}
