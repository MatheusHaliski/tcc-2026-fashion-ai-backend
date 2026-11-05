'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/i18n';
import { Badge, Button, Card, Field, Input } from '@/components/ui';
import type { ProductionRequest, SampleDeviation } from './production-contracts';

export interface ProductionActions { received?: () => void; deviation?: (body: { measurementPoint: string; expected: string; measured: string }) => void; decide?: (deviation: SampleDeviation, accept: boolean, justification: string) => void; approve?: () => void; cancel?: () => void }

function DeviationRow({ item, busy, onDecide }: { item: SampleDeviation; busy: boolean; onDecide?: (accept: boolean, justification: string) => void }) {
  const { t } = useI18n();
  const [justification, setJustification] = useState('');
  return <li className="list-row grid gap-1">
    <span className="type-body-sm">{item.measurementPoint}: {t('production.expected')} {item.expected} · {t('production.measured')} {item.measured} · <Badge tone={item.decision === 'PENDING' ? 'mark' : 'chalk'}>{t(`production.decision.${item.decision}`)}</Badge>{item.justification ? ` — ${item.justification}` : ''}</span>
    {onDecide && item.decision === 'PENDING' && <span className="flex flex-wrap items-end gap-2">
      <Field id={`just-${item.id}`} label={t('production.justification')} className="mb-0"><Input id={`just-${item.id}`} maxLength={1000} value={justification} onChange={e => setJustification(e.target.value)} /></Field>
      <Button size="sm" variant="primary" disabled={busy || !justification.trim()} onClick={() => onDecide(true, justification)}>{t('production.acceptDeviation')}</Button>
      <Button size="sm" disabled={busy} onClick={() => onDecide(false, justification)}>{t('production.returnSample')}</Button></span>}
  </li>;
}

/** Um pedido de amostra: revisão congelada, BOM/tolerâncias, desvios e o estado da aprovação. */
export function ProductionCard({ item, busy, actions }: { item: ProductionRequest; busy: boolean; actions: ProductionActions }) {
  const { t, fmtDate } = useI18n();
  const [deviation, setDeviation] = useState({ measurementPoint: '', expected: '', measured: '' });
  return <Card>
    <div className="flex flex-wrap items-center gap-2"><b>{item.projectTitle ?? item.producerName ?? item.producerId}</b><Badge tone="thread">{t(`production.status.${item.status}`)}</Badge>
      {item.approvalValid && <Badge tone="chalk">{t('production.approvalValid')}</Badge>}{item.invalidatedByRevision && <Badge tone="mark">{t('production.invalidated')}</Badge>}
      <span className="type-caption text-muted">{t('production.meta', { number: item.revisionNumber, date: fmtDate(item.createdAt) })}</span></div>
    <p className="type-caption text-muted">{t('production.tolerances')}: {Object.entries(item.tolerances).map(([point, tol]) => `${point} ${tol}`).join(' · ') || t('atelierProjects.unspecified')}</p>
    <p className="type-caption text-muted">{t('production.bomFrozen', { count: item.bomSnapshot.length })}</p>
    {item.deviations.length > 0 && <ul className="grid gap-1">{item.deviations.map(row => <DeviationRow key={row.id} item={row} busy={busy} onDecide={actions.decide ? (accept, justification) => actions.decide!(row, accept, justification) : undefined} />)}</ul>}
    {actions.deviation && ['SAMPLE_RECEIVED', 'DEVIATIONS_RECORDED'].includes(item.status) && <div className="grid gap-2 sm:grid-cols-4">
      <Field id={`dp-${item.id}`} label={t('production.point')}><Input id={`dp-${item.id}`} maxLength={80} value={deviation.measurementPoint} onChange={e => setDeviation({ ...deviation, measurementPoint: e.target.value })} /></Field>
      <Field id={`de-${item.id}`} label={t('production.expected')}><Input id={`de-${item.id}`} maxLength={120} value={deviation.expected} onChange={e => setDeviation({ ...deviation, expected: e.target.value })} /></Field>
      <Field id={`dm-${item.id}`} label={t('production.measured')}><Input id={`dm-${item.id}`} maxLength={120} value={deviation.measured} onChange={e => setDeviation({ ...deviation, measured: e.target.value })} /></Field>
      <div className="flex items-end"><Button size="sm" disabled={busy || !deviation.measurementPoint.trim() || !deviation.expected.trim() || !deviation.measured.trim()} onClick={() => { actions.deviation!(deviation); setDeviation({ measurementPoint: '', expected: '', measured: '' }); }}>{t('production.recordDeviation')}</Button></div>
    </div>}
    <div className="flex flex-wrap gap-2">
      {actions.received && ['SAMPLE_REQUESTED', 'RETURNED'].includes(item.status) && <Button size="sm" disabled={busy} onClick={actions.received}>{t('production.sampleReceived')}</Button>}
      {actions.approve && ['SAMPLE_RECEIVED', 'DEVIATIONS_RECORDED'].includes(item.status) && <Button size="sm" variant="primary" disabled={busy || item.pendingDeviations > 0 || !item.currentRevision} onClick={actions.approve}>{t('production.approve')}</Button>}
      {actions.cancel && !['APPROVED', 'CANCELLED'].includes(item.status) && <Button size="sm" disabled={busy} onClick={actions.cancel}>{t('common.cancel')}</Button>}
    </div>
    <p className="type-caption text-muted">{t('production.noCommitment')}</p>
  </Card>;
}
