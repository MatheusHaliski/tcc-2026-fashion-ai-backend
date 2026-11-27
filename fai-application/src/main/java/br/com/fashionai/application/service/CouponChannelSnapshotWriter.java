package br.com.fashionai.application.service;

import java.util.Map;

import br.com.fashionai.domain.model.CanalCupom;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;

/**
 * Exercício 14 — o cupom emitido guarda o canal que a oferta tinha na hora da emissão (FK + código). Cada cupom vem
 * da sua origem real: resgate de promoção de selo ({@link PromotionRedemption}) ou de combinação FLAIR
 * ({@link FlairRedemption}). {@code CouponRight} é só o direito de resgatar e não recebe canal.
 */
public final class CouponChannelSnapshotWriter {
    private CouponChannelSnapshotWriter() {
    }

    public static void issue(PromotionRedemption cupom, Promotion oferta) {
        CanalCupom canal = oferta.getCanalCupom();
        cupom.setCanalCupom(canal);
        cupom.setCanalCodigoSnapshot(canal == null ? null : canal.getCodigo());
    }

    public static void issue(FlairRedemption cupom, FlairCombination oferta) {
        CanalCupom canal = oferta.getCanalCupom();
        cupom.setCanalCupom(canal);
        cupom.setCanalCodigoSnapshot(canal == null ? null : canal.getCodigo());
    }

    /** Leitura do cupom emitido: o canal gravado nele (nunca o canal atual da oferta). Cupom antigo: os dois nulos. */
    public static Map<String, Object> read(Map<String, Object> view, CanalCupom canal, String codigoSnapshot) {
        view.put("canalCupom", CouponChannelResolver.view(canal));
        view.put("canalCodigoSnapshot", codigoSnapshot);
        return view;
    }
}
