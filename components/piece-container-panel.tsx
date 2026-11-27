"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Chip } from "@/components/ui";
import { ContainerColor, OptionStrip } from "@/components/background-studio";
import type { PieceArt } from "@/lib/piece-art";

/** Segmento "Container" do editor da arte da peça: cor, acabamento sólido/vidro e o fundo da área da foto. */
export function PieceContainerPanel({ art, skin, onArt, mediaPanel }: { art: PieceArt; skin: string; onArt: (next: PieceArt) => void; mediaPanel?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3">
      <p className="type-caption text-muted">{t("pieceArt.superficie_ajuda")}</p>
      <ContainerColor value={{ container: { color: art.surface.color } }} skin={skin} onChange={(p) => onArt({ ...art, surface: { ...art.surface, color: p.container?.color ?? null } })} />
      <OptionStrip kind="row" title={t("pieceArt.acabamento_do_container")}>
        {(["solid", "frosted"] as const).map((s) => <Chip key={s} active={art.surface.style === s} onClick={() => onArt({ ...art, surface: { ...art.surface, style: s } })}>{t(`pieceArt.surface.${s}`)}</Chip>)}
      </OptionStrip>
      <div className="rounded-md border border-line-soft p-3">
        <p className="label">{t("pieceArt.fundo_da_area_da_peca")}</p>
        {mediaPanel ?? <p className="type-caption text-muted">{t("pieceArt.fundo_da_area_da_peca_ajuda")}</p>}
      </div>
    </div>
  );
}
