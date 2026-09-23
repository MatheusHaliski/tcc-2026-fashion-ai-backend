"use client";
import { RequireAuth } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { SchemeBuilder } from "@/components/scheme-builder";
import { useI18n } from "@/lib/i18n/i18n";

export default function NewSchemePage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t("scheme.create")} kicker="RF5 · RF11" /><SchemeBuilder /></RequireAuth>;
}
