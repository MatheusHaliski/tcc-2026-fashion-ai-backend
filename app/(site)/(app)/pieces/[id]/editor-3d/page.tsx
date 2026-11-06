'use client';
import { use } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/components/app-shell';
import { PieceEditor } from '@/components/piece3d/piece-editor';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
export default function PieceEditor3dPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t } = useI18n();
  return <RequireAuth><PageHeader title={t('editor3d.title')} lead={t('editor3d.lead')} kicker={t('sheet.title')} actions={<Link className="btn" href={`/pieces/${encodeURIComponent(id)}/sheet`}>{t('sheet.title')}</Link>} /><PieceEditor pieceId={id} /></RequireAuth>;
}
