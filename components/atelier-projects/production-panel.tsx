'use client';
import { useState } from 'react';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n } from '@/lib/i18n/i18n';
import { useAuth } from '@/lib/auth/session';
import { Button, Card, EmptyState, Field, Input, Skeleton, useToast } from '@/components/ui';
import type { ProjectDetail } from './contracts';
import { productionApi } from './production-api';
import { ProductionCard } from './production-card';

/** RF-PESQ-06 — pedidos de amostra do projeto; a aprovação é da autoria, nunca do voto social. */
export function ProductionPanel({ detail }: { detail: ProjectDetail }) {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const id = detail.project.id; const latest = detail.latestRevision; const owner = user?.id === detail.project.ownerId;
  const rows = useApi(signal => productionApi.list(id, signal), [id]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ producerUsername: '', point: 'Tórax', tolerance: '±1 cm' });
  async function run(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true);
    try { await action(); rows.reload(); } catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  if (!latest) return <EmptyState title={t('sourcing.noRevision')} hint={t('production.noRevisionHint')} />;
  return <div className="grid gap-4">
    {owner && <Card><h2 className="type-h3">{t('production.requestTitle')}</h2><p className="type-body-sm text-muted">{t('production.requestHint', { number: latest.number })}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field id="prod-producer" label={t('production.producer')}><Input id="prod-producer" maxLength={80} value={form.producerUsername} onChange={e => setForm({ ...form, producerUsername: e.target.value })} /></Field>
        <Field id="prod-point" label={t('production.point')}><Input id="prod-point" maxLength={80} value={form.point} onChange={e => setForm({ ...form, point: e.target.value })} /></Field>
        <Field id="prod-tol" label={t('production.toleranceValue')}><Input id="prod-tol" maxLength={120} value={form.tolerance} onChange={e => setForm({ ...form, tolerance: e.target.value })} /></Field>
      </div>
      <Button variant="primary" loading={busy} disabled={!form.producerUsername.trim() || !form.point.trim() || !form.tolerance.trim()} onClick={() => run(() => productionApi.request(id, { revisionId: latest.id, producerUsername: form.producerUsername, tolerances: { [form.point]: form.tolerance }, quoteId: null }, crypto.randomUUID()))}>{t('production.send')}</Button>
    </Card>}
    {rows.loading && !rows.data ? <Skeleton className="h-24" /> : (rows.data ?? []).length === 0 ? <p className="type-body-sm text-muted">{t('production.none')}</p> : (rows.data ?? []).map(item => <ProductionCard key={item.id} item={item} busy={busy} actions={owner ? {
      received: () => run(() => productionApi.received(item.id, item.version)), deviation: body => run(() => productionApi.deviation(item.id, body)),
      decide: (deviation, accept, justification) => run(() => productionApi.decide(item.id, deviation.id, { accept, justification })),
      approve: () => run(() => productionApi.approve(item.id, item.version)), cancel: () => run(() => productionApi.cancel(item.id, item.version)),
    } : {}} />)}
  </div>;
}

/** Caixa do produtor: só os pedidos endereçados a ele, com a ficha congelada; registra amostra e desvios. */
export function ProductionInbox() {
  const { t } = useI18n(); const toast = useToast();
  const rows = useApi(signal => productionApi.inbox(signal), []);
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true);
    try { await action(); rows.reload(); } catch (error) { toast.fromError(error); } finally { setBusy(false); }
  }
  if (rows.loading && !rows.data) return <Skeleton className="h-24" />;
  if ((rows.data ?? []).length === 0) return <EmptyState title={t('production.inboxEmpty')} />;
  return <div className="grid gap-3">{(rows.data ?? []).map(item => <ProductionCard key={item.id} item={item} busy={busy} actions={{ received: () => run(() => productionApi.received(item.id, item.version)), deviation: body => run(() => productionApi.deviation(item.id, body)) }} />)}</div>;
}
