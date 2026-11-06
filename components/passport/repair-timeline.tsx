'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/i18n';
import { repairsApi, type RepairOrder } from '@/lib/passport/repairs';
import { Badge, Button, Input } from '@/components/ui';

/** Trilha da ordem: estados, autoria e correções (o evento anterior permanece visível). */
export function RepairTimeline({ order, busy, onCorrect }: { order: RepairOrder; busy: boolean; onCorrect?: (eventId: string, notes: string) => void }) {
  const { t, fmtDate } = useI18n();
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  return <ol className="grid gap-1 type-caption text-muted" aria-label={t('repair.timeline')}>{order.events.map(event => <li key={event.id} className="flex flex-wrap items-center gap-2">
    <span>{fmtDate(event.at)} · {t(`repair.role.${event.actorRole}`)} · {event.correctsEventId ? t('repair.correction') : t(`repair.status.${event.toStatus}`)}{event.notes ? ` — ${event.notes}` : ''}</span>
    {onCorrect && !event.correctsEventId && event.actorRole === order.role && <Button size="sm" disabled={busy} onClick={() => setCorrecting(event.id)}>{t('repair.correct')}</Button>}
    {correcting === event.id && <span className="flex gap-2"><Input aria-label={t('repair.correctionNotes')} value={notes} onChange={e => setNotes(e.target.value)} /><Button size="sm" variant="primary" disabled={busy || !notes.trim()} onClick={() => { onCorrect?.(event.id, notes); setCorrecting(null); setNotes(''); }}>{t('common.save')}</Button></span>}
  </li>)}</ol>;
}

export function RepairBadges({ order }: { order: RepairOrder }) {
  const { t } = useI18n();
  return <span className="flex flex-wrap items-center gap-2"><Badge tone="thread">{t(`repair.status.${order.status}`)}</Badge>
    {order.attestation === 'PROVIDER_DECLARED' && <Badge tone="chalk">{t('repair.providerDeclared')}</Badge>}
    <span className="type-caption text-muted">{t('repair.notCertified')}</span>{order.accessRevoked && <Badge tone="mark">{t('repair.revoked')}</Badge>}</span>;
}
