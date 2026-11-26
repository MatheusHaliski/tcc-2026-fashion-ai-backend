package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.MirrorCatalogService;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Rotas do espelho com o catálogo de marcas: POST /api/me/mirror/catalog veste e DELETE /api/me/mirror/catalog/{id} tira,
 * repassando a sessão e só o id do produto ao serviço e devolvendo o estado do espelho que ele monta.
 */
class MirrorCatalogControllerTest {
    private final CurrentUser ana = new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, "127.0.0.1", "junit");

    /** Dublê que grava as chamadas (o serviço de verdade precisa do banco). */
    static final class Recorder extends MirrorCatalogService {
        final List<Object[]> calls = new ArrayList<>();
        final Map<String, Object> state = Map.of("slots", Map.of());

        Recorder() {
            super(null, null, null);
        }

        @Override
        public Map<String, Object> wear(CurrentUser user, UUID productId) {
            calls.add(new Object[]{"wear", user, productId});
            return state;
        }

        @Override
        public Map<String, Object> takeOff(CurrentUser user, UUID productId) {
            calls.add(new Object[]{"takeOff", user, productId});
            return state;
        }
    }

    @Test
    void vestirETirarDelegamAoServicoComASessaoEOId() throws Exception {
        Recorder service = new Recorder();
        MirrorCatalogController controller = new MirrorCatalogController(service);
        UUID product = UUID.randomUUID();

        assertThat(controller.wear(ana, new MirrorCatalogController.ProductRequest(product))).isSameAs(service.state);
        assertThat(controller.takeOff(ana, product)).isSameAs(service.state);
        // corpo ausente vira produto nulo: o serviço responde 400 com a mensagem, não um erro interno
        controller.wear(ana, null);
        assertThat(service.calls).extracting(c -> c[0]).containsExactly("wear", "takeOff", "wear");
        assertThat(service.calls).allSatisfy(c -> assertThat(c[1]).isSameAs(ana));
        assertThat(service.calls).extracting(c -> c[2]).containsExactly(product, product, null);

        assertThat(MirrorCatalogController.class.getAnnotation(RequestMapping.class).value()).containsExactly("/api/me/mirror/catalog");
        assertThat(MirrorCatalogController.class.getMethod("wear", CurrentUser.class, MirrorCatalogController.ProductRequest.class)
                .isAnnotationPresent(PostMapping.class)).isTrue();
        assertThat(MirrorCatalogController.class.getMethod("takeOff", CurrentUser.class, UUID.class)
                .getAnnotation(DeleteMapping.class).value()).containsExactly("/{productId}");
    }
}
