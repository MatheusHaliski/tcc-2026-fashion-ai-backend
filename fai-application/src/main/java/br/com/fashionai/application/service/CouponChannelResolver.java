package br.com.fashionai.application.service;

import java.util.UUID;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.view.Views.ReferenceOptionView;
import br.com.fashionai.domain.model.CanalCupom;
import br.com.fashionai.domain.repository.CanalCupomRepository;

/**
 * Exercício 14 — resolve o canal de utilização escolhido numa oferta de cupom (promoção de selo ou combinação FLAIR).
 * Sem ID a oferta fica sem canal ("não informado"). ID inexistente e canal desativado voltam 400; o canal desativado
 * que a oferta já tinha continua aceito, para ela seguir editável.
 */
public final class CouponChannelResolver {
    private final CanalCupomRepository canais;

    public CouponChannelResolver(CanalCupomRepository canais) {
        this.canais = canais;
    }

    public CanalCupom resolve(UUID canalCupomId, CanalCupom atual) {
        if (canalCupomId == null) {
            return null;
        }
        if (atual != null && canalCupomId.equals(atual.getId())) {
            return atual;
        }
        CanalCupom canal = canais.findById(canalCupomId)
                .orElseThrow(() -> ApiException.badRequest("CANAL_CUPOM_INVALIDO", Msg.t("coupon.canal_invalido")));
        if (!canal.isAtivo()) {
            throw ApiException.badRequest("CANAL_CUPOM_INATIVO", Msg.t("coupon.canal_inativo"));
        }
        return canal;
    }

    /** O serviço montado sem o repositório de canais (testes antigos) só aceita oferta sem canal. */
    public static CanalCupom resolve(CouponChannelResolver channels, UUID canalCupomId, CanalCupom atual) {
        if (channels == null && canalCupomId != null) {
            throw ApiException.badRequest("CANAL_CUPOM_INVALIDO", Msg.t("coupon.canal_invalido"));
        }
        return channels == null ? null : channels.resolve(canalCupomId, atual);
    }

    public static ReferenceOptionView view(CanalCupom canal) {
        return canal == null ? null : new ReferenceOptionView(canal.getId(), canal.getCodigo(), canal.getNome());
    }
}
