"use client";

import { RequireAuth } from "@/components/app-shell";
import { LaundryBoard } from "@/components/laundry/laundry-board";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

export default function LaundryPage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t("laundry.title")} lead={t("laundry.lead")} kicker={t("closet.title")} /><LaundryBoard /></RequireAuth>;
}
