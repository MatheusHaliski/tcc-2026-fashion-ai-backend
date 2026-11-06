'use client';
import { use } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/components/app-shell';
import { DigitalPassportSheet } from '@/components/passport/digital-passport';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
export default function PieceSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t } = useI18n();
  return <RequireAuth><PageHeader title={t('sheet.title')} lead={t('sheet.lead')} kicker={t('passport.title')} actions={<Link className="btn" href={`/pieces/${encodeURIComponent(id)}`}>{t('sheet.backToPiece')}</Link>} /><DigitalPassportSheet pieceId={id} /></RequireAuth>;
}
