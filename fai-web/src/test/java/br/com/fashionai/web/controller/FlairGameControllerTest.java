package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FlairChallengeService;
import br.com.fashionai.application.service.FlairGameService;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Glass Empire — o controller só delega (R3: dublê escrito à mão, fora de ServiceFakes/ControllerDelegacaoTest): cada
 * rota chama o método certo do serviço com os mesmos argumentos, os filtros viram {@code Filters} na ordem da query e
 * o submit responde 201.
 */
class FlairGameControllerTest {
    /** Dublê: registra a chamada e devolve um mapa que a identifica. */
    static final class ServiceDouble extends FlairGameService {
        final List<String> calls = new ArrayList<>();
        Object[] lastArgs;

        ServiceDouble() {
            super(null, null, null, null, null, null, null, null);
        }

        private Map<String, Object> record(String name, Object... args) {
            calls.add(name);
            lastArgs = args;
            return Map.of("via", name);
        }

        @Override
        public Map<String, Object> summary(CurrentUser viewer) {
            return record("summary", viewer);
        }

        @Override
        public Map<String, Object> list(CurrentUser viewer, Filters f) {
            return record("list", viewer, f);
        }

        @Override
        public Map<String, Object> detail(CurrentUser viewer, String slug) {
            return record("detail", viewer, slug);
        }

        @Override
        public Map<String, Object> check(CurrentUser user, String slug, FlairChallengeService.BuildRequest req) {
            return record("check", user, slug, req);
        }

        @Override
        public Map<String, Object> submit(CurrentUser user, String slug, FlairChallengeService.BuildRequest req) {
            return record("submit", user, slug, req);
        }
    }

    private final ServiceDouble service = new ServiceDouble();
    private final FlairGameController controller = new FlairGameController(service);
    private final CurrentUser ana = new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);

    @Test
    void summaryEDetalheDelegamComOVisitanteMesmoNulo() {
        assertThat(controller.summary(null)).containsEntry("via", "summary");
        assertThat(service.lastArgs).containsExactly((Object) null);
        assertThat(controller.detail(ana, "a01-espelho-partido")).containsEntry("via", "detail");
        assertThat(service.lastArgs).containsExactly(ana, "a01-espelho-partido");
        assertThat(service.calls).containsExactly("summary", "detail");
    }

    @Test
    void listaTransformaOsParametrosDaQueryEmFiltrosNaOrdem() {
        assertThat(controller.list(ana, "LOFT", "BEM_CURADO", "HARD", "RARE", "B", "RUNWAY", "neon")).containsEntry("via", "list");
        assertThat(service.lastArgs[0]).isEqualTo(ana);
        assertThat(service.lastArgs[1]).isEqualTo(new FlairGameService.Filters("LOFT", "BEM_CURADO", "HARD", "RARE", "B", "RUNWAY", "neon"));
        controller.list(null, null, null, null, null, null, null, null);
        assertThat(service.lastArgs[1]).isEqualTo(new FlairGameService.Filters(null, null, null, null, null, null, null));
    }

    @Test
    void checkESubmitRepassamUsuarioSlugECorpo() {
        FlairChallengeService.BuildRequest body = new FlairChallengeService.BuildRequest(Map.of("caco", UUID.randomUUID()), null);
        assertThat(controller.check(ana, "a01-espelho-partido", body)).containsEntry("via", "check");
        assertThat(service.lastArgs).containsExactly(ana, "a01-espelho-partido", body);
        assertThat(controller.submit(ana, "a01-espelho-partido", body)).containsEntry("via", "submit");
        assertThat(service.lastArgs).containsExactly(ana, "a01-espelho-partido", body);
        assertThat(service.calls).containsExactly("check", "submit");
    }

    @Test
    void rotasEStatusSeguemOContrato() throws Exception {
        assertThat(route("summary", GetMapping.class)).isEqualTo("/api/flair/games/summary");
        assertThat(route("list", GetMapping.class)).isEqualTo("/api/flair/games");
        assertThat(route("detail", GetMapping.class)).isEqualTo("/api/flair/games/{slug}");
        assertThat(route("check", PostMapping.class)).isEqualTo("/api/flair/games/{slug}/check");
        assertThat(route("submit", PostMapping.class)).isEqualTo("/api/flair/games/{slug}/submit");
        Method submit = method("submit");
        assertThat(submit.getAnnotation(ResponseStatus.class).value().value()).isEqualTo(201);
        assertThat(method("check").getAnnotation(ResponseStatus.class)).isNull();
        // "summary" é declarado antes de "{slug}": o literal vence a variável de caminho
        List<String> order = new ArrayList<>();
        for (Method m : FlairGameController.class.getDeclaredMethods()) {
            if (m.isAnnotationPresent(GetMapping.class)) {
                order.add(m.getAnnotation(GetMapping.class).value()[0]);
            }
        }
        assertThat(order).contains("/api/flair/games/summary", "/api/flair/games/{slug}");
    }

    static Method method(String name) {
        for (Method m : FlairGameController.class.getDeclaredMethods()) {
            if (m.getName().equals(name)) {
                return m;
            }
        }
        throw new AssertionError(name);
    }

    static String route(String name, Class<?> mapping) {
        Method m = method(name);
        return mapping == GetMapping.class ? m.getAnnotation(GetMapping.class).value()[0] : m.getAnnotation(PostMapping.class).value()[0];
    }
}
