"use client";
import { pieceImageUrl } from "@/lib/pieces/piece-image";
import { useI18n } from "@/lib/i18n/i18n";
import { Badge, Button, type MenuItem } from "@/components/ui";
import { PieceRowCompact } from "@/components/pieces/piece-row-compact";
import { assetStateOf } from "@/lib/mirror/asset-state";
import { ASSET_TONE } from "@/components/mirror/mirror-parts-grid";
import { isCatalogPiece, tryOnRef, type MirrorPart, type MirrorPieceRef } from "@/lib/mirror/mirror-model";

/**
 * Peça vestida na folha da parte do Espelho, no card compacto do Provador.
 *  - Da pessoa: origem "Meu guarda-roupa", endereço no ACERVO, Tirar, Manter (âncora do Vista-me) e, no menu ⋯, Provar
 *    no provador e Tirar da lista do espelho.
 *  - Da loja (catálogo de marcas, só para provar): marca, origem "Loja", o nome leva à página oficial do produto, Tirar e
 *    Provar no provador com o produto — sem Manter nem lista do espelho, que são das peças da pessoa.
 */
export function MirrorWornRow({ p, part, pinned, busy, onTogglePin, takeOff, unlist }: {
  p: MirrorPieceRef; part: MirrorPart; pinned: boolean; busy: string | null; onTogglePin: (id: string) => void;
  takeOff: (p: MirrorPieceRef) => Promise<void>; unlist: (p: MirrorPieceRef) => Promise<void>;
}) {
  const { t } = useI18n();
  const store = isCatalogPiece(p);
  const asset = assetStateOf(p);
  const menu: MenuItem[] = [
    { label: t("mirror.provar_no_provador"), href: `/try-on?provar=${encodeURIComponent(tryOnRef(p))}` },
    { label: t("mirror.sheet.tirar_da_lista"), onSelect: () => void unlist(p), danger: true, hidden: store },
  ];
  return (
    <PieceRowCompact kicker={t(part.label)} thumb={pieceImageUrl(p, 320)} glyph={part.glyph}
      brand={store && p.brand ? { name: p.brand.name, logoUrl: p.brand.logoUrl } : null}
      source={store ? { label: t("tryOn.origem_loja"), tone: "thread" } : { label: t("tryOn.origem_guarda_roupa"), tone: "chalk" }}
      meta={store ? null : p.addressLabel} name={p.name} href={store ? p.officialUrl : `/pieces/${p.id}`} external={store}
      tone={p.available === false ? "mark" : undefined}
      state={<>
        <Badge tone={ASSET_TONE[asset]}>{t(`room.mirror.asset.${asset}`)}</Badge>
        {p.available === false && <span className="text-mark">⚠ {t("mirror.parte.indisponivel")}</span>}
      </>}
      actions={<>
        <Button size="sm" disabled={busy !== null} onClick={() => void takeOff(p)} aria-label={t("mirror.sheet.tirar_aria", { name: p.name })}>{t("room.mirror.remove")}</Button>
        {!store && <Button size="sm" aria-pressed={pinned} onClick={() => onTogglePin(p.id)} title={t("mirror.sheet.manter_dica")}>{pinned ? `📌 ${t("mirror.parte.fixada")}` : t("mirror.sheet.manter")}</Button>}
      </>}
      menu={menu} menuLabel={t("tryOn.mais_acoes", { name: p.name })} />
  );
}
