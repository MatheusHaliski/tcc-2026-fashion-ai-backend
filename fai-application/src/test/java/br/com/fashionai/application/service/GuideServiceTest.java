package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserGuide;
import br.com.fashionai.domain.repository.UserGuideRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Orientação "Como funciona": primeira visita, "Entendi" sem marcar (volta no máximo uma vez, em outro dia),
 * "Não mostrar novamente" por tutorial, versão que reapresenta e troca de conta.
 */
class GuideServiceTest {
    static final Instant T0 = Instant.parse("2026-10-10T12:00:00Z");
    private Kit kit;
    private GuideService service;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        User a = kit.save(UserRepository.class, Kit.user("ana"));
        User b = kit.save(UserRepository.class, Kit.user("bia"));
        ana = Kit.as(a);
        bia = Kit.as(b);
        service = kit.build(GuideService.class);
        at(T0);
    }

    void at(Instant now) {
        service.useClock(Clock.fixed(now, ZoneOffset.UTC));
    }

    UserGuide stored(CurrentUser u, String key) {
        return kit.dep(UserGuideRepository.class).findByUserIdAndGuideKey(u.id(), key).orElse(null);
    }

    @Test
    void primeiraVisitaAbreEntendiSemMarcarVoltaUmaVezEmOutroDia() {
        assertThat(GuideService.shouldAutoOpen(null, 1, T0)).isTrue();                   // primeira visita
        service.record(ana, "flair.cbc", new GuideService.GuideEvent(1, "AUTO_SHOWN"));
        service.record(ana, "flair.cbc", new GuideService.GuideEvent(1, "CLOSED"));
        UserGuide g = stored(ana, "flair.cbc");
        assertThat(GuideService.shouldAutoOpen(g, 1, T0.plusSeconds(60))).isFalse();     // não reabre na mesma visita
        assertThat(GuideService.shouldAutoOpen(g, 1, T0.plusSeconds(86_400 + 60))).isTrue(); // volta em outro dia
        at(T0.plusSeconds(86_400 + 60));
        service.record(ana, "flair.cbc", new GuideService.GuideEvent(1, "AUTO_SHOWN"));
        assertThat(GuideService.shouldAutoOpen(stored(ana, "flair.cbc"), 1, T0.plusSeconds(86_400L * 5))).isFalse(); // no máximo 2 vezes
    }

    @Test
    void naoMostrarNovamenteValeSoParaAqueleTutorialEAteAVersaoSubir() {
        service.record(ana, "flair.cbc", new GuideService.GuideEvent(1, "HIDDEN"));
        assertThat(GuideService.shouldAutoOpen(stored(ana, "flair.cbc"), 1, T0.plusSeconds(86_400L * 30))).isFalse();
        assertThat(GuideService.shouldAutoOpen(stored(ana, "moments.calendar"), 1, T0)).isTrue();   // outro tutorial continua
        // a "Como funciona" reabre sempre e não conta como automática
        Map<String, Object> manual = service.record(ana, "flair.cbc", new GuideService.GuideEvent(1, "MANUAL_SHOWN"));
        assertThat(manual).containsEntry("hidden", true).containsEntry("autoCount", 0);
        // mudança relevante de funcionamento (versão 2): reapresenta uma vez
        assertThat(GuideService.shouldAutoOpen(stored(ana, "flair.cbc"), 2, T0)).isTrue();
        service.record(ana, "flair.cbc", new GuideService.GuideEvent(2, "AUTO_SHOWN"));
        assertThat(stored(ana, "flair.cbc").isHidden()).isFalse();
        assertThat(stored(ana, "flair.cbc").getVersion()).isEqualTo(2);
    }

    @Test
    void trocaDeContaNaoHerdaAPreferenciaEEntradaInvalidaRecusa() {
        service.record(ana, "explore.search", new GuideService.GuideEvent(1, "HIDDEN"));
        assertThat(service.mine(bia).get("guides")).isEqualTo(Map.of());
        assertThat(stored(bia, "explore.search")).isNull();
        assertThatThrownBy(() -> service.record(ana, "../x", new GuideService.GuideEvent(1, "HIDDEN"))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.record(ana, "flair.cbc", new GuideService.GuideEvent(1, "APAGAR"))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.record(ana, "flair.cbc", new GuideService.GuideEvent(0, "HIDDEN"))).isInstanceOf(ApiException.class);
    }
}
