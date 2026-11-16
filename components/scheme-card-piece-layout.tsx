"use client";
import { label } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { brickColor } from "@/lib/card-art";
import { areaShares, costPerUse, pieceSealPlacement, type AnatomyPiece, type PieceAnatomyId } from "@/components/scheme-anatomies";
import { SealSlot, type SealBadge } from "@/components/scheme-card-seals";

/** No card ampliado a peça inteira é o alvo do toque: abre a peça ampliada (RF7.CA01/CA03). */
function pieceAction(id: string, onPiece?: (pieceId: string) => void) {
  if (!onPiece) return {};
  return {
    role: "button" as const, tabIndex: 0,
    onClick: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onPiece(id); },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPiece(id); } },
  };
}

/**
 * Peças do look no layout de peça escolhido no Background Studio (seção C · versão por modelo). A anatomia do card
 * (seção A) decide onde as peças ficam — abaixo do título ou ao lado da foto (`side`, lista lateral); esta decide como
 * cada peça aparece. O selo da peça segue PIECE_SEAL_PLACEMENT: COVER_CORNER sobre a foto, HEADER no cabeçalho da
 * etiqueta ou do valor de uso, TITLE_ROW depois do nome, META_BLOCK depois dos atributos e STUDS numa placa redonda.
 * A Peça ampliada (padrão) continua nas linhas .piece2 do próprio card.
 */
export function PieceLayout({ anatomy, pieces, side, sealsOf, onPiece }: { anatomy: PieceAnatomyId; pieces: AnatomyPiece[]; side?: boolean; sealsOf: (id?: string) => SealBadge[]; onPiece?: (pieceId: string) => void }) {
  const { t, fmtPriceShort } = useI18n();
  const zone = pieceSealPlacement(anatomy).zone;
  const headerSeal = zone === "HEADER" && (anatomy === "ETIQUETA" || anatomy === "CUSTO_POR_USO");
  const thumbSeal = zone === "COVER_CORNER" || (zone === "HEADER" && !headerSeal);
  const money = (v?: number | null) => fmtPriceShort(v);
  const size = (p: AnatomyPiece) => (p.size ? p.size.replace(/^(br|shoe)_/i, "").toUpperCase() : null);
  const colorName = (p: AnatomyPiece) => (p.color ? label(p.color) : null);
  const hex = (p: AnatomyPiece) => (p.colorHex?.startsWith("#") ? p.colorHex : undefined);
  const shares = anatomy === "ESPECTRO" ? areaShares(pieces) : [];
  const metaOf = (p: AnatomyPiece): string | null => {
    const uses = p.wearCount ?? 0;
    switch (anatomy) {
      case "ETIQUETA": return [size(p) ? `${t("anatomy.tag.size")} ${size(p)}` : null, colorName(p)].filter(Boolean).join(" · ") || label(p.slot.toLowerCase());
      case "RAIO_X": return [p.material ? label(p.material.toLowerCase()) : null, colorName(p)].filter(Boolean).join(" · ") || label(p.slot.toLowerCase());
      case "BENTO": return [p.brand, p.price != null ? money(p.price) : null].filter(Boolean).join(" · ") || "—";
      case "ESPECTRO": return [colorName(p), hex(p)?.toUpperCase()].filter(Boolean).join(" · ") || "—";
      case "CUSTO_POR_USO": return p.price == null ? t("anatomy.noPrice") : uses > 0 ? t("anatomy.cpu.division", { money: money(p.price), count: uses }) : t("anatomy.cpu.notUsed");
      default: return null; // Passarela: só nome e preço sob a foto
    }
  };
  return (
    <div className={`lp-block ${side ? "is-side" : ""}`}>
      {anatomy === "ESPECTRO" && !side && pieces.length > 0 && (
        <span className="lp-band" role="img" aria-label={t("anatomy.spectrum.aria", { list: pieces.map((p, i) => `${colorName(p) ?? "—"} ≈ ${shares[i]}%`).join(", ") })}>
          {pieces.map((p, i) => <i key={`${p.id}-${i}`} style={{ background: hex(p), flexGrow: shares[i] || 1 }} />)}
        </span>
      )}
      {pieces.map((p, i) => {
        const own = sealsOf(p.id);
        const seal = own.length > 0 ? <SealSlot inline px={20} seals={own} /> : null;
        const key = `${p.id}-${i}`;
        if (anatomy === "LEGO") return (
          <div key={key} className={`lp brick-piece ${onPiece ? "is-action" : ""}`} style={{ ["--brick" as string]: brickColor(p.colorHex) }} {...pieceAction(p.id, onPiece)}>
            <span className="brick-photo">{p.img && <img src={p.img} alt="" loading="lazy" />}</span>
            <span className="brick-label">{p.name}</span>
            {seal && <span className="lp-stud">{seal}</span>}
          </div>
        );
        const meta = metaOf(p);
        const cpu = anatomy === "CUSTO_POR_USO" ? costPerUse(p.price, p.wearCount) : null;
        return (
          <div key={key} className={`lp ${onPiece ? "is-action" : ""}`} style={anatomy === "ESPECTRO" && hex(p) ? { ["--lp" as string]: hex(p) } : undefined} {...pieceAction(p.id, onPiece)}>
            {anatomy === "ETIQUETA" && <span className="lp-hole" aria-hidden />}
            {anatomy === "RAIO_X" && <i className="lp-pin" aria-hidden>{i + 1}</i>}
            <span className="lp-thumb">{p.img && <img src={p.img} alt="" loading="lazy" />}{thumbSeal && seal && <span className="lp-seal">{seal}</span>}</span>
            <span className="lp-txt">
              {anatomy === "ETIQUETA" && <span className="lp-head"><span>{(p.brand ?? t("anatomy.noBrand")).toUpperCase()}</span>{headerSeal && seal}</span>}
              <span className="lp-name"><b>{p.name}</b>{zone === "TITLE_ROW" && seal}</span>
              {anatomy === "CUSTO_POR_USO" && <span className="lp-cpu">{cpu != null && <b className="tabular">{t("anatomy.cpu.perUse", { value: money(cpu) })}</b>}{headerSeal && seal}</span>}
              {(meta != null || zone === "META_BLOCK") && <span className="lp-meta">{meta != null && <span>{meta}</span>}{zone === "META_BLOCK" && seal}</span>}
            </span>
            <span className="lp-price tabular">{money(p.price)}</span>
          </div>
        );
      })}
    </div>
  );
}
