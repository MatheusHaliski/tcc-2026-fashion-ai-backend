'use client';
import { RequireAuth } from '@/components/app-shell';
import { QuoteInbox } from '@/components/atelier-projects/quote-inbox';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
export default function AtelierQuotesPage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t('sourcing.inboxTitle')} lead={t('sourcing.inboxLead')} kicker={t('atelierProjects.title')} /><QuoteInbox /></RequireAuth>;
}
