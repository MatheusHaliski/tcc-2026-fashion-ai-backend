"use client";
import { ReferenceSelectField, type ReferenceFieldProps } from "@/components/reference-select-field";
import { tr } from "@/lib/i18n/i18n";

/** Exercício 14 — canal gravado no cupom emitido: o código da hora da emissão e, quando existir, a opção da tabela. */
export interface CouponChannel { canalCupom?: { id: string; codigo: string; nome: string } | null; canalCodigoSnapshot?: string | null }
const CODIGOS = ["LOJA_FISICA", "ECOMMERCE", "AMBOS"];

/** Canal de utilização da oferta de cupom (promoção de selo e combinação FLAIR). O valor é o UUID da opção. */
export function CouponChannelField(props: ReferenceFieldProps) {
  return <ReferenceSelectField {...props} id="canalCupomId" path="/api/opcoes/canais-cupom" messages="coupons.canal" stateAttr="coupon-channel" />;
}

/**
 * Texto do canal de um cupom emitido. Usa o código gravado na emissão (traduzido); código que a tela não conhece mostra
 * o nome cadastrado; cupom antigo, sem canal, mostra "não informado" (nunca deduzido do link da loja).
 */
export function couponChannelText(c: CouponChannel): string {
  const codigo = c.canalCodigoSnapshot ?? c.canalCupom?.codigo ?? null;
  const canal = !codigo ? tr("coupons.canal.nao_informado") : CODIGOS.includes(codigo) ? tr(`coupons.canal.codigo.${codigo}`) : c.canalCupom?.nome ?? codigo;
  return tr("coupons.canal.onde", { canal });
}
