"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { SealSlot } from "@/components/scheme-card-seals";
import type { SelectedSealRef } from "@/lib/seals/selected-seals";
import { useSealArt, type SealArtTier } from "@/lib/seals/use-seal-art";

/**
 * Selos escolhidos no criador (ainda sem vínculo aprovado): cada um aparece com a ARTE real que o emissor desenhou no
 * editor de selos. Emissor sem selo publicado (ou arte ainda carregando) fica com o nome, para o selo nunca sumir.
 */
export function SelectedSealLabels({ seals, tier = "PECA" }: { seals: SelectedSealRef[]; tier?: SealArtTier }) {
  const { t } = useI18n();
  const art = useSealArt(seals.map((seal) => seal.key), tier);
  if (!seals.length) return null;
  return <div className="grid gap-1" aria-label={t("selectedSeals.label")}>
    <span className="type-caption text-muted">{t("selectedSeals.label")}</span>
    <span className="selected-seals">{seals.map((seal, index) => {
      const found = art(seal.key);
      return found
        ? <span className="selected-seal" key={`${seal.key}-${index}`}>
            <SealSlot inline px={40} seals={[{ label: seal.name, name: found.name, owner: found.owner, premium: found.premium, tier: found.tier, iconUrl: found.iconUrl, design: found.design, kind: found.premium ? "CELEBRITY" : "BRAND" }]} />
            <span className="selected-seal-name">{seal.name}</span>
          </span>
        : <span className="badge" key={`${seal.key}-${index}`}>{seal.name}</span>;
    })}</span>
  </div>;
}
