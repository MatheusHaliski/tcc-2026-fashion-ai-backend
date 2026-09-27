"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { RequireAuth } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { DnaBuilder } from "@/components/dna-builder";

/**
 * Aba DNA de estilo (RF13): só o criador de look DNA — igual ao Criar Look (RF5), com a diferença de que a lista de
 * itens são os looks (esquemas de vestimenta) da pessoa. Os cards criados aqui ficam na sub-aba "Meus looks DNA de
 * estilo" do perfil. Variações de card e arte de fundo (aura, material, skin) seguem docs/anatomias/anatomia_cards_DNA_v4.
 */
function Dna() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("nav.dna")} kicker={t("dna.rf13_hu20")} lead={t("dna.crie_esquemas_do_tipo_dna")} />
      <DnaBuilder />
    </>
  );
}
export default function DnaPage() { return <RequireAuth><Dna /></RequireAuth>; }
