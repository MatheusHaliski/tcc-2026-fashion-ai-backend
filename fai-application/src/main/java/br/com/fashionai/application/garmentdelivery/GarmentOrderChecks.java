package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.VersionCmd;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;

/** Pré-condições das ações na encomenda: sessão válida e versão esperada igual à gravada. */
final class GarmentOrderChecks {
    private GarmentOrderChecks() {
    }

    static void version(GarmentOrder order, VersionCmd cmd) {
        if (cmd == null || order.getVersion() != cmd.expectedVersion()) {
            throw ApiException.conflict("GARMENT_ORDER_VERSION_CONFLICT", Msg.t("garmentDelivery.erro.versao"));
        }
    }

    static void authenticated(CurrentUser user) {
        if (user == null) {
            throw ApiException.unauthorized(Msg.t("common.faca_login_para_continuar"));
        }
        if (user.status() == AccountStatus.DELETED) {
            throw ApiException.notFound(Msg.t("garmentDelivery.encomenda"));
        }
    }
}
