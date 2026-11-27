package br.com.fashionai.application.service;

import java.math.BigDecimal;
import java.util.Map;

import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;

/**
 * Exercícios 14 e 15 — condições do cupom na hora da emissão: canal de utilização e compra mínima com a moeda
 * contratada. Gravadas no cupom na mesma transação da emissão; a leitura do cupom usa o que foi gravado nele, nunca a
 * regra atual da oferta.
 */
public final class CouponTermsSnapshotWriter {
    /** O cupom tem o mínimo gravado. */
    public static final String REGISTRADO = "REGISTRADO";
    /** Nada gravado e a oferta também não tem mínimo hoje. */
    public static final String SEM_MINIMO = "SEM_MINIMO";
    /** Nada gravado, mas a oferta tem mínimo hoje: não se sabe qual condição valia na emissão. */
    public static final String NAO_REGISTRADO = "NAO_REGISTRADO";

    private CouponTermsSnapshotWriter() {
    }

    public static void issue(PromotionRedemption cupom, Promotion oferta) {
        CouponChannelSnapshotWriter.issue(cupom, oferta);
        cupom.setMinPurchaseSnapshot(oferta.getMinPurchase());
        cupom.setMinPurchaseCurrencySnapshot(oferta.getMinPurchase() == null ? null : oferta.getMinPurchaseCurrency());
    }

    public static void issue(FlairRedemption cupom, FlairCombination oferta) {
        CouponChannelSnapshotWriter.issue(cupom, oferta);
        cupom.setMinPurchaseSnapshot(oferta.getMinPurchase());
        cupom.setMinPurchaseCurrencySnapshot(oferta.getMinPurchase() == null ? null : oferta.getMinPurchaseCurrency());
    }

    public static Map<String, Object> read(Map<String, Object> view, PromotionRedemption r) {
        CouponChannelSnapshotWriter.read(view, r.getCanalCupom(), r.getCanalCodigoSnapshot());
        view.put("hypeLevelSnapshot", r.getHypeLevelSnapshot());   // Circuito Aura: a faixa do card na emissão, nunca a atual
        return minimum(view, r.getMinPurchaseSnapshot(), r.getMinPurchaseCurrencySnapshot(), r.getPromotion().getMinPurchase());
    }

    public static Map<String, Object> read(Map<String, Object> view, FlairRedemption r) {
        CouponChannelSnapshotWriter.read(view, r.getCanalCupom(), r.getCanalCodigoSnapshot());
        view.put("hypeLevelSnapshot", r.getHypeLevelSnapshot());
        return minimum(view, r.getMinPurchaseSnapshot(), r.getMinPurchaseCurrencySnapshot(), r.getCombination().getMinPurchase());
    }

    private static Map<String, Object> minimum(Map<String, Object> view, BigDecimal snapshot, String currency, BigDecimal offerNow) {
        view.put("minPurchaseSnapshot", snapshot);
        view.put("minPurchaseCurrencySnapshot", currency);
        view.put("minPurchaseSnapshotStatus", snapshot != null ? REGISTRADO : offerNow == null ? SEM_MINIMO : NAO_REGISTRADO);
        return view;
    }
}
