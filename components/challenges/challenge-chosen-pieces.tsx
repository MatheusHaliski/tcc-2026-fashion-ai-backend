"use client";
import { api } from "@/lib/api/client";
import { pieceImageUrl } from "@/lib/pieces/piece-image";
import type { Page, PieceView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Card } from "@/components/ui";

/** As peças escolhidas para o desafio (10×10, Temporada cápsula): a página mostra quais são, com foto e nome. */
export function ChallengeChosenPieces({ pieceIds }: { pieceIds: string[] }) {
  const { t } = useI18n();
  const closet = useApi<Page<PieceView>>((signal) => api.get("/api/me/closet?size=100", { signal }), [], { enabled: pieceIds.length > 0 });
  if (!pieceIds.length) return null;
  const byId = new Map((closet.data?.items ?? []).map((p) => [p.id, p]));
  return (
    <Card>
      <p className="label">{t("challenges.id.pecas_escolhidas", { count: pieceIds.length })}</p>
      <ul className="grid grid-cols-5 gap-2 mt-2" aria-label={t("challenges.id.pecas_escolhidas", { count: pieceIds.length })}>
        {pieceIds.map((id) => {
          const piece = byId.get(id);
          return (
            <li key={id} className="min-w-0 text-center">
              <div className="aspect-square overflow-hidden rounded bg-surface-2">
                {piece ? <img src={pieceImageUrl(piece, 320)} alt="" className="h-full w-full object-contain" /> : null}
              </div>
              <span className="type-caption block truncate" title={piece?.name}>{piece?.name ?? (closet.loading ? "…" : t("challenges.id.peca_fora"))}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
