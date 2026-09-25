"use client";
import { label } from "@/lib/api/taxonomy";
import type { UserCard } from "@/lib/api/types";
import { Button, Dialog } from "@/components/ui";
import { useI18n, tr } from "@/lib/i18n/i18n";
import { currentIntl } from "@/lib/i18n/state";

/** Tipos e utilitários do FLAIR compartilhados entre a página /flair e a aba da loja (RF14/RF22). */
export interface Check { kind: string; value: string; label: string; ok: boolean; }

export interface Coupon { title: string; discountPercent: number | ""; discountAmount: number | ""; minPurchase: number | ""; validDays: number; }

export interface Voucher { id: string; code: string; status: string; expiresAt: string; usedAt?: string | null; createdAt: string; deck?: string | null; deckPower?: number | null; user: UserCard; combination: { id: string; name: string; brandName: string; coupon: string; discountPercent: number | ""; discountAmount: number | ""; minPurchase: number | ""; accentColor: string }; }

export interface Combination {
  id: string; brand: UserCard; brandName: string; brandSlug?: string | null; name: string; description?: string | null; gameType: "COMBINACAO" | "COLECAO" | "DUELO_PATROCINADO";
  requiredCategories: string[]; requiredStyles: string[]; requiredOccasions: string[]; minBrandPieces: number; minDeckPower: number; minRarity?: string | null; minWins: number;
  coupon: Coupon; stock?: number | null; redeemed: number; active: boolean; available: boolean; startsAt?: string | null; endsAt?: string | null; accentColor: string;
  redemption?: Voucher | null; bestDeck?: { schemeId: string; title: string; power: number } | null; checks?: Check[]; complete?: boolean;
}

export const GAME_TYPE_LABEL: Record<string, string> = { get COMBINACAO() { return tr("flair.flairShared.combinacao_um_deck"); }, get COLECAO() { return tr("common.colecao_guarda_roupa"); }, get DUELO_PATROCINADO() { return tr("common.duelo_patrocinado"); } };

export function couponText(c: { discountPercent: number | ""; discountAmount: number | ""; minPurchase: number | "" }) {
  const off = c.discountPercent !== "" ? `${c.discountPercent}% off` : c.discountAmount !== "" ? `R$ ${Number(c.discountAmount).toFixed(0)} off` : "";
  return `${off}${c.minPurchase !== "" ? tr("flair.flairShared.compra_minima_r", { toFixed: Number(c.minPurchase).toFixed(0) }) : ""}`;
}

export function checkLabel(c: Check) {
  switch (c.kind) {
    case "CATEGORY": return `Categoria: ${label(c.value)}`;
    case "STYLE": return `Estilo: ${label(c.value)}`;
    case "OCCASION": return tr("flair.flairShared.ocasiao", { label: label(c.value) });
    default: return c.label;
  }
}

export function VoucherDialog({ voucher, onClose }: { voucher: Voucher | null; onClose: () => void }) {
  const { rich, t } = useI18n();
  return (
    <Dialog open={!!voucher} onClose={onClose} title={voucher ? t("flair.flairShared.cupom", { brandName: voucher.combination.brandName }) : ""} footer={<Button variant="primary" onClick={onClose}>{t("common.close")}</Button>}>
      {voucher && <div className="text-center">
        <p className="type-h3">{voucher.combination.coupon}</p>
        <p className="type-caption text-muted">{couponText(voucher.combination)}</p>
        <p className="flair-code flair-code-lg my-4" aria-label={t("flair.flairShared.codigo", { join: voucher.code.split("").join(" ") })}>{voucher.code}</p>
        <p className="type-body-sm">{rich("flair.flairShared.mostre_este_codigo_no_caixa", { status: voucher.status, value: voucher.expiresAt ? t("flair.flairShared.valido_ate", { toLocaleDateString: new Date(voucher.expiresAt).toLocaleDateString(currentIntl()) }) : "" }, { 0: ($c) => <b>{$c}</b> })}</p>
        {voucher.deck && <p className="type-caption text-muted mt-1">{t("flair.flairShared.trocado_com_o_deck_poder", { deck: voucher.deck, deckPower: voucher.deckPower })}</p>}
      </div>}
    </Dialog>
  );
}
