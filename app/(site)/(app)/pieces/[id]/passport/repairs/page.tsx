'use client';
import { use } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/components/app-shell';
import { RepairOrdersPanel } from '@/components/passport/repair-orders';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
export default function PassportRepairsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { t } = useI18n();
  return <RequireAuth><PageHeader title={t('repair.title')} lead={t('repair.lead')} kicker={t('passport.title')} actions={<Link className="btn" href={`/pieces/${encodeURIComponent(id)}/passport`}>{t('passport.title')}</Link>} /><RepairOrdersPanel pieceId={id} /></RequireAuth>;
}
