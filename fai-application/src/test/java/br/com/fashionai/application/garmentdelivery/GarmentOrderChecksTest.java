package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.VersionCmd;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

/** Pré-condições das ações na encomenda à Fábrica: sessão válida e versão esperada igual à gravada. */
class GarmentOrderChecksTest {

    private static CurrentUser user(AccountStatus status) {
        return new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, true, status, "127.0.0.1", "test");
    }

    @Test
    void versaoIgualAGravadaPassa() {
        GarmentOrder order = new GarmentOrder();   // encomenda nova: versão 0
        assertThatCode(() -> GarmentOrderChecks.version(order, new VersionCmd(0))).doesNotThrowAnyException();
    }

    @Test
    void versaoDiferenteOuAusenteEConflito() {
        GarmentOrder order = new GarmentOrder();
        for (VersionCmd cmd : new VersionCmd[]{new VersionCmd(1), null}) {
            assertThatThrownBy(() -> GarmentOrderChecks.version(order, cmd))
                    .isInstanceOfSatisfying(ApiException.class, e -> {
                        assertThat(e.status()).isEqualTo(409);
                        assertThat(e.code()).isEqualTo("GARMENT_ORDER_VERSION_CONFLICT");
                    });
        }
    }

    @Test
    void semSessaoPedeLogin() {
        assertThatThrownBy(() -> GarmentOrderChecks.authenticated(null))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(401));
    }

    @Test
    void contaExcluidaNaoVeAEncomenda() {
        assertThatThrownBy(() -> GarmentOrderChecks.authenticated(user(AccountStatus.DELETED)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
    }

    @Test
    void contaAtivaPassa() {
        assertThatCode(() -> GarmentOrderChecks.authenticated(user(AccountStatus.ACTIVE))).doesNotThrowAnyException();
    }
}
