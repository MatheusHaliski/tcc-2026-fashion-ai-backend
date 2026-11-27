"use client";

import { RequireAuth } from "@/components/app-shell";
import { ShoppingPlanner } from "@/components/shopping/shopping-plan";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

export default function ShoppingPlanPage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t("shopping.title")} lead={t("shopping.lead")} kicker={t("nav.lookbook")} /><ShoppingPlanner /></RequireAuth>;
}
