"use client";
import { RequireAuth } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { DnaBuilder } from "@/components/dna-builder";
import { useI18n } from "@/lib/i18n/i18n";

export default function NewDnaSchemePage() {
  const { t } = useI18n();
  return <RequireAuth><PageHeader title={t("common.criar_dna_de_estilo")} kicker={t("dnaSchemes.new.rf13_rf11")} lead={t("dnaSchemes.new.mesmo_fluxo_do_rf5_o")} /><DnaBuilder /></RequireAuth>;
}
