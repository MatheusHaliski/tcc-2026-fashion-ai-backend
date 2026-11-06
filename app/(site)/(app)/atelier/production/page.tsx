'use client';
import { RequireAuth } from '@/components/app-shell';
import { ProductionInbox } from '@/components/atelier-projects/production-panel';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
export default function AtelierProductionPage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t('production.inboxTitle')} lead={t('production.inboxLead')} kicker={t('nav.atelier')} /><ProductionInbox /></RequireAuth>;
}
