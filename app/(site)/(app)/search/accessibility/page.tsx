"use client";

import { RequireAuth } from "@/components/app-shell";
import { AccessibilitySearch } from "@/components/catalog/accessibility-search";
import { PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

export default function AccessibilitySearchPage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t("accessibility.title")} lead={t("accessibility.lead")} kicker={t("nav.search")} /><AccessibilitySearch /></RequireAuth>;
}
