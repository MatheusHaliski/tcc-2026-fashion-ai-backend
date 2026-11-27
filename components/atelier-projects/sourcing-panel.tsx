'use client';
import { useState } from 'react';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { useAuth } from '@/lib/auth/session';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import type { ProjectDetail } from './contracts';
import type { BomKind, QuoteRequest } from './sourcing-contracts';
import { sourcingApi } from './sourcing-api';

const KINDS: BomKind[] = ['MATERIAL', 'TRIM', 'LABOR', 'PACKAGING'];
const SIZES = ['PP', 'P', 'M', 'G', 'GG'];

function QuoteRequestCard({ item, canAccept, busy, onAccept }: { item: QuoteRequest; canAccept: boolean; busy: boolean; onAccept: (quoteId: string, version: number) => void }) {
  const { t, fmtDate, fmtMoney } = useI18n();
  return <Card><div className="flex flex-wrap items-center gap-2"><b>{item.supplierName ?? item.supplierId}</b><Badge tone="thread">{t(`sourcing.status.${item.status}`)}</Badge>{item.outdated && <Badge tone="mark">{t('sourcing.outdated')}</Badge>}<span className="type-caption text-muted">{t('sourcing.requestMeta', { number: item.revisionNumber, units: item.totalUnits, currency: item.currency })}</span></div>
    <p className="type-caption text-muted">{Object.entries(item.sizes).map(([size, qty]) => `${size}: ${qty}`).join(' · ')}</p>
    {item.quotes.length === 0 ? <p className="type-body-sm text-muted">{t('sourcing.noQuotes')}</p> : <ul className="grid gap-2">{item.quotes.map(quote => <li key={quote.id} className="list-row grid gap-1">
      <span className="type-body-sm">{quote.unitPrice != null ? `${t('sourcing.unitPrice')}: ${fmtMoney(quote.unitPrice, quote.currency)} · ${t('sourcing.sampleCost')}: ${fmtMoney(quote.sampleCost ?? 0, quote.currency)}` : t('sourcing.priceHidden')} · {t('sourcing.leadTime', { days: quote.leadTimeDays })} · {t('sourcing.validUntil', { date: fmtDate(quote.validUntil) })}{quote.expired ? ` · ${t('sourcing.expired')}` : ''}</span>
      <span className="flex flex-wrap items-center gap-2"><Badge tone="chalk">{t(`sourcing.quoteStatus.${quote.status}`)}</Badge>{quote.acceptedAt && <span className="type-caption text-muted">{t('sourcing.acceptedMeta', { date: fmtDate(quote.acceptedAt), version: quote.acceptedProjectVersion ?? 0 })}</span>}
        {canAccept && quote.status === 'SUBMITTED' && !quote.expired && !item.outdated && <Button size="sm" variant="primary" disabled={busy} onClick={() => onAccept(quote.id, quote.version)}>{t('sourcing.accept')}</Button>}</span>
    </li>)}</ul>}
    <p className="type-caption text-muted">{t('sourcing.noCommitment')}</p>
  </Card>;
}

/** RF-PESQ-04 — BOM da revisão vigente e pedidos de cotação; interesse da comunidade não vira compra. */
export function SourcingPanel({ detail }: { detail: ProjectDetail }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const latest = detail.latestRevision;
  const id = detail.project.id;
  const bom = useApi(signal => latest ? sourcingApi.bom(id, latest.id, signal) : Promise.resolve([]), [id, latest?.id]);
  const requests = useApi(signal => sourcingApi.requests(id, signal), [id]);
  const [busy, setBusy] = useState(false);
  const [item, setItem] = useState({ kind: 'MATERIAL' as BomKind, name: '', unit: 'm', quantity: '1', notes: '' });
  const [ask, setAsk] = useState({ supplierUsername: '', currency: 'BRL', notes: '', sizes: Object.fromEntries(SIZES.map(size => [size, '0'])) as Record<string, string> });
  const owner = user?.id === detail.project.ownerId;
  async function run(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true);
    try { await action(); bom.reload(); requests.reload(); } catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  if (!latest) return <EmptyState title={t('sourcing.noRevision')} hint={t('sourcing.noRevisionHint')} />;
  const sizes = Object.fromEntries(Object.entries(ask.sizes).map(([size, qty]) => [size, Number(qty)]).filter(([, qty]) => Number(qty) > 0)) as Record<string, number>;
  return <div className="grid gap-4">
    <Card><h2 className="type-h3">{t('sourcing.bomTitle', { number: latest.number })}</h2><p className="type-body-sm text-muted">{t('sourcing.bomHint')}</p>
      {bom.loading && !bom.data ? <Skeleton className="h-16" /> : (bom.data ?? []).length === 0 ? <p className="type-body-sm text-muted">{t('sourcing.bomEmpty')}</p> : <ul className="grid gap-1">{(bom.data ?? []).map(row => <li key={row.id} className="list-row flex items-center justify-between gap-2"><span className="type-body-sm"><Badge tone="chalk">{t(`sourcing.kind.${row.kind}`)}</Badge> {row.name} · {row.quantity} {row.unit}{row.notes ? ` · ${row.notes}` : ''}</span>{detail.capabilities.edit && <Button size="sm" disabled={busy} onClick={() => run(() => sourcingApi.removeBomItem(id, row.id))}>{t('common.remove')}</Button>}</li>)}</ul>}
      {detail.capabilities.edit && <div className="mt-3 grid gap-2 sm:grid-cols-5">
        <Field id="bom-kind" label={t('sourcing.kindLabel')}><Select id="bom-kind" value={item.kind} onChange={e => setItem({ ...item, kind: e.target.value as BomKind })}>{KINDS.map(kind => <option key={kind} value={kind}>{t(`sourcing.kind.${kind}`)}</option>)}</Select></Field>
        <Field id="bom-name" label={t('sourcing.itemName')}><Input id="bom-name" maxLength={160} value={item.name} onChange={e => setItem({ ...item, name: e.target.value })} /></Field>
        <Field id="bom-qty" label={t('sourcing.quantity')}><Input id="bom-qty" type="number" min={0.001} step={0.001} value={item.quantity} onChange={e => setItem({ ...item, quantity: e.target.value })} /></Field>
        <Field id="bom-unit" label={t('sourcing.unit')}><Input id="bom-unit" maxLength={20} value={item.unit} onChange={e => setItem({ ...item, unit: e.target.value })} /></Field>
        <div className="flex items-end"><Button variant="primary" loading={busy} disabled={!item.name.trim() || !item.unit.trim() || Number(item.quantity) <= 0} onClick={() => run(async () => { await sourcingApi.addBomItem(id, { revisionId: latest.id, kind: item.kind, name: item.name, unit: item.unit, quantity: Number(item.quantity), notes: item.notes }, crypto.randomUUID()); setItem({ ...item, name: '' }); })}>{t('sourcing.addItem')}</Button></div>
      </div>}
    </Card>
    {owner && <Card><h2 className="type-h3">{t('sourcing.requestTitle')}</h2><p className="type-body-sm text-muted">{t('sourcing.requestHint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field id="ask-supplier" label={t('sourcing.supplier')}><Input id="ask-supplier" maxLength={80} value={ask.supplierUsername} onChange={e => setAsk({ ...ask, supplierUsername: e.target.value })} /></Field>
        <Field id="ask-currency" label={t('sourcing.currency')}><Input id="ask-currency" maxLength={3} value={ask.currency} onChange={e => setAsk({ ...ask, currency: e.target.value.toUpperCase() })} /></Field>
      </div>
      <div className="grid grid-cols-5 gap-2">{SIZES.map(size => <Field key={size} id={`ask-size-${size}`} label={size}><Input id={`ask-size-${size}`} type="number" min={0} value={ask.sizes[size]} onChange={e => setAsk({ ...ask, sizes: { ...ask.sizes, [size]: e.target.value } })} /></Field>)}</div>
      <Field id="ask-notes" label={t('sourcing.notes')}><Textarea id="ask-notes" maxLength={2000} value={ask.notes} onChange={e => setAsk({ ...ask, notes: e.target.value })} /></Field>
      <Button variant="primary" loading={busy} disabled={!ask.supplierUsername.trim() || Object.keys(sizes).length === 0} onClick={() => run(() => sourcingApi.requestQuote(id, { revisionId: latest.id, supplierUsername: ask.supplierUsername, currency: ask.currency, sizes, notes: ask.notes }, crypto.randomUUID()))}>{t('sourcing.sendRequest')}</Button>
    </Card>}
    <div className="grid gap-3">{requests.loading && !requests.data ? <Skeleton className="h-24" /> : (requests.data ?? []).length === 0 ? <p className="type-body-sm text-muted">{t('sourcing.noRequests')}</p> : (requests.data ?? []).map(row => <QuoteRequestCard key={row.id} item={row} canAccept={owner} busy={busy} onAccept={(quoteId, version) => run(() => sourcingApi.accept(id, quoteId, version))} />)}</div>
  </div>;
}
