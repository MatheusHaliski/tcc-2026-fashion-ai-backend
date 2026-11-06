'use client';
import { RequireAuth } from '@/components/app-shell';
import { RepairInbox } from '@/components/passport/repair-inbox';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n/i18n';
export default function RepairOrdersPage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t('repair.inboxTitle')} lead={t('repair.inboxLead')} kicker={t('passport.title')} /><RepairInbox /></RequireAuth>;
}
