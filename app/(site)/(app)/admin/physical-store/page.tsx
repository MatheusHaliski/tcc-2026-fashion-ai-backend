"use client";

import { RequireAuth } from "@/components/app-shell";
import { AdminPhysicalStore } from "@/components/points/physical-store";
import { ReturnsInbox } from "@/components/points/store-returns-inbox";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

export default function AdminPhysicalStorePage() {
  const { t } = useI18n();
  return <RequireAuth admin><PageHeader title={t("physicalStore.adminTitle")} lead={t("physicalStore.adminLead")} /><AdminPhysicalStore /><div className="mt-8"><ReturnsInbox /></div></RequireAuth>;
}
