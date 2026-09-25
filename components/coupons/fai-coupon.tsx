"use client";
import { mediaUrl } from "@/lib/api/client";
import type { UserCard } from "@/lib/api/types";
import { cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";

/** Card Trello RF38 — Cupom Fashion AI (tipos compartilhados pela carteira do usuário e pela aba da marca). */
export interface CouponOwner { user: UserCard; name: string; kind: "MARCA" | "CELEBRIDADE" | "PESSOAL"; logoUrl?: string | null; slug?: string | null; storeUrl?: string | null; }
export interface Coupon {
  id: string; source: "SELO" | "FLAIR"; origin?: string | null; code: string; title: string; subtitle?: string | null; discount: string;
  discountPercent?: number | null; discountAmount?: number | null; minPurchase?: number | null; status: "EMITIDO" | "USADO" | "EXPIRADO";
  expiresAt?: string | null; issuedAt?: string | null; owner: CouponOwner; storeUrl?: string | null; accentColor: string; holder?: UserCard;
}
export interface CouponRight { id: string; source: "SELO" | "FLAIR"; title: string; detail?: string | null; status: string; createdAt: string; owner: CouponOwner; question: string; }

const SOURCE_LABEL: Record<string, string> = { SELO: "Selo", FLAIR: "Jogo FLAIR" };
const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "sem validade");

/** Valor em destaque: "15%", "R$ 60" ou o texto do benefício. */
function bigValue(c: Pick<Coupon, "discountPercent" | "discountAmount" | "discount">) {
  if (c.discountPercent != null) return { v: `${c.discountPercent}%`, unit: "OFF" };
  if (c.discountAmount != null) return { v: `R$ ${Math.round(Number(c.discountAmount))}`, unit: "OFF" };
  return { v: "★", unit: c.discount };
}

/**
 * Desenho do cupom: canhoto com o logo FAI (sempre presente) e o selo "Cupom Fashion AI", picote com recortes, corpo
 * na cor da marca com logo, valor, código e validade. Tocar abre a loja terceira em outra aba (fora do app FAI).
 */
export function FaiCoupon({ coupon, preview, onClick, compact }: { coupon: Coupon | (Omit<Coupon, "code" | "status" | "id"> & { code?: string; status?: Coupon["status"]; id?: string }); preview?: boolean; onClick?: () => void; compact?: boolean }) {
  const { rich, t } = useI18n();
  const c = coupon; const val = bigValue(c); const status = c.status ?? "EMITIDO";
  const usable = !preview && status === "EMITIDO" && !!c.storeUrl;
  const body = (
    <div className={cn("fai-coupon", compact && "fai-coupon-compact", status !== "EMITIDO" && "fai-coupon-off")} style={{ ["--coupon" as string]: c.accentColor }}>
      <div className="fai-coupon-stub">
        <img src="/brand/fai-logo.png" alt="Fashion AI" className="fai-coupon-logo" draggable={false} />
        <span className="fai-coupon-stub-label">{rich("coupons.faiCoupon.cupom_fashion_ai", undefined, { 0: () => <br /> })}</span>
        <span className="fai-coupon-source">{SOURCE_LABEL[c.source] ?? c.source}</span>
      </div>
      <div className="fai-coupon-main">
        <div className="flex items-center gap-2">
          {c.owner.logoUrl ? <img src={mediaUrl(c.owner.logoUrl)} alt="" className="fai-coupon-brand-logo" /> : <span className="fai-coupon-brand-logo fai-coupon-brand-initial">{c.owner.name.slice(0, 1)}</span>}
          <div className="min-w-0">
            <p className="fai-coupon-brand">{c.owner.name}</p>
            {c.origin && <p className="fai-coupon-origin">{c.origin}</p>}
          </div>
        </div>
        <div className="fai-coupon-value"><b>{val.v}</b><span>{val.unit}</span></div>
        <p className="fai-coupon-title">{c.title}</p>
        {c.discountPercent == null && c.discountAmount == null ? null : <p className="fai-coupon-terms">{c.discount}</p>}
        <div className="fai-coupon-foot">
          <code className="fai-coupon-code">{preview ? t("coupons.faiCoupon.fai") : c.code}</code>
          <span>{t("coupons.faiCoupon.valido_ate", { date: date(c.expiresAt) })}</span>
        </div>
        {!preview && <p className="fai-coupon-cta">{status === "EMITIDO" ? (c.storeUrl ? t("coupons.faiCoupon.usar_na_loja") : t("coupons.faiCoupon.mostre_o_codigo_na_loja")) : status === "USADO" ? t("coupons.faiCoupon.cupom_usado") : t("coupons.faiCoupon.cupom_expirado")}</p>}
      </div>
      {status !== "EMITIDO" && <span className="fai-coupon-stamp">{status}</span>}
    </div>
  );
  if (onClick) return <button type="button" className="block w-full text-left" onClick={onClick} aria-label={t("coupons.faiCoupon.cupom_de", { title: c.title, name: c.owner.name })}>{body}</button>;
  if (usable) return <a href={c.storeUrl!} target="_blank" rel="noopener noreferrer" className="block" aria-label={t("coupons.faiCoupon.usar_o_cupom_na_loja", { title: c.title, name: c.owner.name })}>{body}</a>;
  return body;
}
