"use client";
import { pieceImageUrl } from "@/lib/pieces/piece-image";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, cn } from "@/components/ui";
import { GarmentGlyph } from "@/components/capture/garment-glyphs";
import { assetStateOf } from "@/lib/mirror/asset-state";
import { asList, inHandOf, isCatalogPiece, MIRROR_PARTS, type MirrorData, type MirrorPieceRef } from "@/lib/mirror/mirror-model";

export const ASSET_TONE = { PENDING: "mark", IMAGE_2D: "chalk", MOULD_3D: undefined, MODEL_3D: "thread" } as const;

/**
 * "Partes do look" do Espelho: a grade de células do Provador (Parte de cima, Peça única, Parte de baixo, Calçado,
 * Acessório). A camada externa do servidor (jaqueta, blazer…) entra na Parte de cima. Cada célula mostra o que está
 * vestido (da pessoa ou da loja), a falta, a cobertura pela peça única, o estado do asset, as roupas em mãos e a peça
 * fixada; tocar abre a folha da parte. Saiu de mirror-controls.tsx sem mudar o DOM.
 */
export function MirrorPartsGrid({ data, held, arrivedId, pinned, open, onOpen }: {
  data: MirrorData; held?: MirrorPieceRef[]; arrivedId?: string | null; pinned: Set<string>; open: string | null; onOpen: (partId: string) => void;
}) {
  const { t } = useI18n();
  const dressOn = asList(data.slots.dress).length > 0;
  return (
    <section className="mirror-section" aria-labelledby="mirror-parts-h">
      <h3 id="mirror-parts-h" className="mirror-section-h">{t("mirror.slots")}</h3>
      <div className="fitting-stores mirror-parts" role="group" aria-labelledby="mirror-parts-h">
        {MIRROR_PARTS.map((p) => {
          const pieces = p.slots.flatMap((s) => asList(data.slots[s]));
          const label = t(p.label);
          // a falta vem do lugar da própria parte: na Parte de cima, só a jaqueta (camada externa) não supre a peça por baixo
          const own = p.id === "top" ? asList(data.slots[p.suggest]) : pieces;
          const missing = (data.missing ?? []).some((m) => m.slot === p.suggest) && own.length === 0;
          const covered = !pieces.length && dressOn && (p.id === "top" || p.id === "lower");
          const under = pieces.length > 0 && missing ? t("mirror.parte.falta_por_baixo") : null;
          const caption = pieces.length
            ? [p.max ? t("mirror.parte.n_de", { n: pieces.length, max: p.max }) : pieces.map((x) => x.name).join(" + "), under].filter(Boolean).join(" · ")
            : covered ? t("mirror.parte.coberto") : missing ? t("mirror.parte.falta") : t("mirror.parte.vazio");
          const asset = pieces[0] ? assetStateOf(pieces[0]) : null;
          const unavailable = pieces.some((x) => x.available === false);
          const pin = pieces.some((x) => pinned.has(x.id));
          const store = pieces.some(isCatalogPiece);
          const hand = inHandOf(p, data, held);
          const arrived = !!arrivedId && hand.some((x) => x.id === arrivedId);
          return (
            <button key={p.id} type="button" className={cn("fitting-store mirror-part", open === p.id && "is-active", missing && "is-missing", !pieces.length && "is-empty", arrived && "is-arrived")}
              aria-haspopup="dialog" aria-label={t("mirror.parte.aria", { part: label, value: pieces.length ? [pieces.map((x) => x.name).join(", "), under].filter(Boolean).join(" · ") : caption })} onClick={() => onOpen(p.id)}>
              <span className="mirror-part-art" aria-hidden>
                {pieces.length ? pieces.slice(0, 2).map((x) => <img key={x.id} src={pieceImageUrl(x, 320)} alt="" style={{ background: x.colorHex ?? undefined }} />)
                  : <GarmentGlyph id={p.glyph} size={36} animated={false} numbered={false} />}
              </span>
              <span className="fitting-store-name">{label}</span>
              <span className="mirror-part-caption">{caption}</span>
              {(asset || unavailable || pin || store || hand.length > 0) && (
                <span className="mirror-part-badges">
                  {asset && <Badge tone={ASSET_TONE[asset]}>{t(`room.mirror.asset_curto.${asset}`)}</Badge>}
                  {store && <Badge tone="thread">{t("tryOn.origem_loja")}</Badge>}
                  {hand.length > 0 && <Badge tone="thread">{t("mirror.parte.em_maos", { n: hand.length })}</Badge>}
                  {unavailable && <Badge tone="mark">⚠ {t("mirror.parte.indisponivel")}</Badge>}
                  {pin && <Badge>📌 {t("mirror.parte.fixada")}</Badge>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {data.warnings?.length ? <ul className="mirror-warnings">{data.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul> : null}
    </section>
  );
}
