"use client";

import { RequireAuth } from "@/components/app-shell";
import { PhysicalStore } from "@/components/points/physical-store";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

export default function PhysicalStorePage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t("physicalStore.title")} lead={t("physicalStore.lead")} kicker={t("nav.points")} /><PhysicalStore /></RequireAuth>;
}
