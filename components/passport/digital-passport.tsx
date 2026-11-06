'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useApi } from '@/lib/hooks/use-api';
import { useI18n, tr } from '@/lib/i18n/i18n';
import { mediaUrl } from '@/lib/api/client';
import { digitalPassportApi, type DigitalPassport, type Provenance, type SheetField, type SizeRow } from '@/lib/passport/digital';
import { Badge, Button, Card, ErrorState, Skeleton } from '@/components/ui';

const PieceModelViewer = dynamic(() => import('@/components/room3d/piece-model-viewer'), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">{tr('pieces.id.carregando_o_modelo_3d')}</div> });

function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const { t } = useI18n();
  return <Badge tone={provenance === 'VERIFIED' ? 'chalk' : provenance === 'ESTIMATED' || provenance === 'NOT_INFORMED' ? 'mark' : 'thread'}>{t(`sheet.provenance.${provenance}`)}</Badge>;
}

function Row({ label, field, render }: { label: string; field: SheetField; render?: (value: unknown) => React.ReactNode }) {
  const { t } = useI18n();
  return <div className="flex flex-wrap items-baseline gap-2 py-1"><dt className="w-40 type-caption text-muted">{label}</dt><dd className="min-w-0 flex-1 type-body-sm">{field.informed ? (render ? render(field.value) : String(field.value)) : <span className="text-muted">{t('sheet.notInformed')}</span>}</dd><ProvenanceBadge provenance={field.provenance} /></div>;
}

export function SizeTable({ rows }: { rows: SizeRow[] }) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="type-body-sm text-muted">{t('sheet.notInformed')}</p>;
  return <table className="w-full type-body-sm"><thead><tr><th className="text-left">{t('size.col.size')}</th><th className="text-left">{t('sheet.availability')}</th><th className="text-left">{t('sheet.measurements')}</th><th className="text-left">{t('sheet.representation')}</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.label}><td>{row.label}{row.ownerDeclared ? ` · ${t('sheet.ownerSize')}` : ''}</td><td>{t(`sheet.availabilityValue.${row.availability}`)}</td>
      <td>{row.measurements.length === 0 ? <span className="text-muted">{t('sheet.notInformed')}</span> : row.measurements.map((m, index) => <span key={index} className="block">{m.region} · {m.min ?? '—'}–{m.max ?? '—'} {m.unit} · {m.protocol} · {t(`sheet.measurementProvenance.${m.provenance}`)}{m.sourceName ? ` (${m.sourceName})` : ''}</span>)}</td>
      <td>{t(`sheet.representationValue.${row.representation}`)}</td></tr>)}</tbody></table>;
}

/** RF — passaporte digital da peça: identificação, imagens/fonte, composição, tamanhos/medidas, modelo 3D, procedência e data. */
export function DigitalPassportSheet({ pieceId }: { pieceId: string }) {
  const { t, fmtDateTime, fmtDate } = useI18n();
  const query = useApi((signal) => digitalPassportApi.sheet(pieceId, signal), [pieceId]);
  const [view3d, setView3d] = useState(false);
  if (query.error) return <ErrorState error={query.error} onRetry={query.reload} />;
  if (!query.data) return <Skeleton className="h-64" />;
  const sheet: DigitalPassport = query.data;
  const reference = sheet.images.reference.informed ? mediaUrl(String(sheet.images.reference.value)) : undefined;
  return <div className="grid gap-4">
    <Card><div className="flex flex-wrap items-center gap-2"><code className="type-caption">{sheet.identifier}</code><Badge tone="chalk">{t(`sheet.access.${sheet.access}`)}</Badge><span className="type-caption text-muted">{t('sheet.lastUpdated', { date: sheet.lastUpdated ? fmtDateTime(sheet.lastUpdated) : t('sheet.notInformed') })}</span></div>
      <p className="type-caption text-muted">{t('sheet.legend')}</p></Card>
    <Card><h2 className="type-h3">{t('sheet.identification')}</h2><dl>
      {(['name', 'brand', 'category', 'subcategory', 'description', 'productCode', 'gtin'] as const).map((key) => <Row key={key} label={t(`sheet.field.${key}`)} field={sheet.identification[key]} />)}
      <Row label={t('sheet.field.catalogVerifiedAt')} field={sheet.identification.catalogVerifiedAt} render={(value) => fmtDate(String(value))} /></dl></Card>
    <Card><h2 className="type-h3">{t('sheet.images')}</h2>{reference && <img src={reference} alt={String(sheet.identification.name.value ?? '')} className="max-h-64 rounded object-contain" />}<dl>
      <Row label={t('sheet.field.reference')} field={{ ...sheet.images.reference, value: t('sheet.imageAvailable') }} />
      <Row label={t('sheet.field.sourceUrl')} field={sheet.images.sourceUrl} render={(value) => <a className="underline" href={String(value)} target="_blank" rel="noreferrer noopener">{String(sheet.images.sourceDomain.value ?? value)}</a>} /></dl></Card>
    <Card><h2 className="type-h3">{t('sheet.materials')}</h2><dl>{(['composition', 'catalogMaterial', 'care', 'washing', 'condition', 'origin', 'manufacturing'] as const).map((key) => <Row key={key} label={t(`sheet.field.${key}`)} field={sheet.materials[key]} />)}</dl></Card>
    <Card><h2 className="type-h3">{t('sheet.sizes')}</h2><SizeTable rows={sheet.sizes.sizes} /><p className="type-caption text-muted">{t(`sheet.note.${sheet.sizes.visualApproximationNote}`)}</p></Card>
    <Card><h2 className="type-h3">{t('sheet.model3d')}</h2><dl>
      <Row label={t('sheet.field.modelKind')} field={{ value: t(`sheet.modelKind.${sheet.model3d.kind}`), provenance: sheet.model3d.provenance, informed: sheet.model3d.kind !== 'NONE' }} />
      <Row label={t('sheet.field.modelReview')} field={{ value: sheet.model3d.quarantine ? t('sheet.quarantine', { status: sheet.model3d.quarantine }) : t(`sheet.modelReview.${sheet.model3d.reviewStatus}`), provenance: sheet.model3d.tryOnApproved ? 'VERIFIED' : 'ESTIMATED', informed: sheet.model3d.kind !== 'NONE' }} />
      <Row label={t('sheet.field.modelOrigin')} field={{ value: sheet.model3d.origin, provenance: sheet.model3d.provenance, informed: !!sheet.model3d.origin }} /></dl>
      {sheet.model3d.displayAllowed && sheet.model3d.viewerUrl.informed && <div className="grid gap-2"><Button onClick={() => setView3d((value) => !value)}>{t(view3d ? 'sheet.hide3d' : 'sheet.view3d')}</Button>{view3d && <div className="h-[360px] overflow-hidden rounded-lg border border-line-soft"><PieceModelViewer url={mediaUrl(String(sheet.model3d.viewerUrl.value)) ?? ''} name={String(sheet.identification.name.value ?? '')} /></div>}<p className="type-caption text-muted">{t('sheet.notApprovedForTryOn')}</p></div>}
      {sheet.access === 'OWNER' && <Link className="btn" href={`/pieces/${encodeURIComponent(pieceId)}/editor-3d`}>{t('sheet.openEditor')}</Link>}
    </Card>
    <p className="type-caption text-muted">{t('sheet.notices')}</p>
  </div>;
}
