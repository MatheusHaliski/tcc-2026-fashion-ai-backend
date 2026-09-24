"use client";
import { label } from "@/lib/api/taxonomy";
import type { UserCard } from "@/lib/api/types";
import { Button, Dialog } from "@/components/ui";

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

export const GAME_TYPE_LABEL: Record<string, string> = { COMBINACAO: "Combinação (um deck)", COLECAO: "Coleção (guarda-roupa)", DUELO_PATROCINADO: "Duelo patrocinado" };

export function couponText(c: { discountPercent: number | ""; discountAmount: number | ""; minPurchase: number | "" }) {
  const off = c.discountPercent !== "" ? `${c.discountPercent}% off` : c.discountAmount !== "" ? `R$ ${Number(c.discountAmount).toFixed(0)} off` : "";
  return `${off}${c.minPurchase !== "" ? ` · compra mínima R$ ${Number(c.minPurchase).toFixed(0)}` : ""}`;
}

export function checkLabel(c: Check) {
  switch (c.kind) {
    case "CATEGORY": return `Categoria: ${label(c.value)}`;
    case "STYLE": return `Estilo: ${label(c.value)}`;
    case "OCCASION": return `Ocasião: ${label(c.value)}`;
    default: return c.label;
  }
}

export function VoucherDialog({ voucher, onClose }: { voucher: Voucher | null; onClose: () => void }) {
  return (
    <Dialog open={!!voucher} onClose={onClose} title={voucher ? `Cupom ${voucher.combination.brandName}` : ""} footer={<Button variant="primary" onClick={onClose}>Fechar</Button>}>
      {voucher && <div className="text-center">
        <p className="type-h3">{voucher.combination.coupon}</p>
        <p className="type-caption text-muted">{couponText(voucher.combination)}</p>
        <p className="flair-code flair-code-lg my-4" aria-label={`Código ${voucher.code.split("").join(" ")}`}>{voucher.code}</p>
        <p className="type-body-sm">Mostre este código no caixa (ou use no site) da loja. Status: <b>{voucher.status}</b>{voucher.expiresAt ? ` · válido até ${new Date(voucher.expiresAt).toLocaleDateString("pt-BR")}` : ""}</p>
        {voucher.deck && <p className="type-caption text-muted mt-1">Trocado com o deck “{voucher.deck}” (poder {voucher.deckPower}).</p>}
      </div>}
    </Dialog>
  );
}
