package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.DailyLookRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

/** RF6 / RF33 §2.3 Look do Dia: registro, troca, continuidade na virada do dia e avaliação (HU19). */
class DailyLookServiceTest {
    Kit kit;
    World world;
    DailyLookService service;
    CurrentUser ana;
    LocalDate today = LocalDate.now(FaiPointsService.ZONE);

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        service = kit.build(DailyLookService.class);
        ana = Kit.as(world.me);
        world.piecesOf(world.me).forEach(w -> {
            w.setDisponivel(true);
            w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        });
    }

    @Test
    void registraOLookDoDiaEMarcaAsPecas() {
        Scheme look = world.looksOf(world.me).get(0);
        WardrobeItem tee = world.itemsOf(look).get(0).getWardrobeItem();
        tee.setLastWornDate(today.plusDays(3));
        DailyLook dl = service.register(ana, look, DailyLookSource.MANUAL, null);
        assertThat(dl.getLookDate()).isEqualTo(today);
        assertThat(look.isLookDoDia()).isTrue();
        assertThat(look.getLookDoDiaCount()).isEqualTo(1);
        assertThat(tee.getLookDoDiaCount()).isEqualTo(1);
        assertThat(tee.getLastWornDate()).isEqualTo(today.plusDays(3));
        assertThat(world.itemsOf(look).get(1).getWardrobeItem().getLastWornDate()).isEqualTo(today);
        verify(kit.dep(ApplicationEventPublisher.class)).publishEvent(any(DomainEvents.DailyLookRegistered.class));

        // outro look no mesmo dia substitui (sem somar de novo)
        Scheme outro = world.looksOf(world.me).get(1);
        DailyLook troca = service.register(ana, outro, DailyLookSource.AUTOPILOTO, today);
        assertThat(troca).isSameAs(dl);
        assertThat(troca.getScheme()).isSameAs(outro);
        assertThat(troca.getSource()).isEqualTo(DailyLookSource.AUTOPILOTO);
        assertThat(outro.getLookDoDiaCount()).isZero();
    }

    @Test
    void pecaIndisponivelNaoViraLookDoDia() {
        Scheme look = world.looksOf(world.me).get(0);
        world.itemsOf(look).get(0).getWardrobeItem().setDisponivel(false);
        assertThatThrownBy(() -> service.register(ana, look, DailyLookSource.MANUAL, today)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("PECA_INDISPONIVEL"));
        world.itemsOf(look).get(0).getWardrobeItem().setDisponivel(true);
        world.itemsOf(look).get(1).getWardrobeItem().setAvailabilityStatus(AvailabilityStatus.UNAVAILABLE);
        assertThatThrownBy(() -> service.register(ana, look, DailyLookSource.MANUAL, today)).isInstanceOf(ApiException.class);
    }

    @Test
    void viradaDoDiaCopiaOMaisRecente() {
        assertThat(service.today(world.me.getId())).isEmpty();
        Scheme look = world.looksOf(world.me).get(0);
        DailyLook ontem = service.register(ana, look, DailyLookSource.COPILOT, today.minusDays(1));
        DailyLook hoje = service.today(world.me.getId()).orElseThrow();
        assertThat(hoje).isNotSameAs(ontem);
        assertThat(hoje.getMaterializedFrom()).isSameAs(ontem);
        assertThat(hoje.getSource()).isEqualTo(DailyLookSource.COPILOT);
        assertThat(service.today(world.me.getId())).contains(hoje);
        assertThat(service.view(hoje)).containsEntry("materialized", true).containsEntry("schemeId", look.getId());
    }

    @Test
    void lookArquivadoNaoContinua() {
        Scheme look = world.looksOf(world.me).get(0);
        service.register(ana, look, DailyLookSource.MANUAL, today.minusDays(2));
        look.setStatus(SchemeStatus.ARCHIVED);
        assertThat(service.today(world.me.getId())).isEmpty();
    }

    @Test
    void avaliacaoEHistorico() {
        assertThatThrownBy(() -> service.feedback(ana, null, DailyLookFeedback.ADOREI)).isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    assertThat(((ApiException) e).code()).isEqualTo("SEM_LOOK_DO_DIA");
                    assertThat(((ApiException) e).details()).containsEntry("href", "/autopilot");
                });
        Map<String, Object> semLook = service.pendingFeedback(ana);
        assertThat(semLook).containsEntry("pending", false).containsEntry("show", false).containsEntry("message", "")
                .containsEntry("dailyLook", null);

        Scheme look = world.looksOf(world.me).get(0);
        service.register(ana, look, DailyLookSource.VISTA_ME, today);
        Map<String, Object> pend = service.pendingFeedback(ana);
        assertThat(pend).containsEntry("pending", true);
        assertThat((String) pend.get("message")).isNotBlank();

        Map<String, Object> v = service.feedback(ana, today, DailyLookFeedback.ADOREI);
        assertThat(v).containsEntry("feedback", "ADOREI").containsEntry("source", "VISTA_ME");
        assertThat(service.pendingFeedback(ana)).containsEntry("pending", false);

        service.register(ana, world.looksOf(world.me).get(1), DailyLookSource.MANUAL, today.minusDays(5));
        assertThat(service.feedback(ana, today.minusDays(5), DailyLookFeedback.NAO_USEI)).containsEntry("feedback", "NAO_USEI");
        assertThatThrownBy(() -> service.feedback(ana, today.minusDays(9), DailyLookFeedback.NAO_GOSTEI)).isInstanceOf(ApiException.class);
        List<Map<String, Object>> hist = service.history(ana);
        assertThat(hist).hasSize(2);
        assertThat(kit.dep(DailyLookRepository.class).findTop60ByUserIdOrderByLookDateDesc(world.me.getId()).get(0).getLookDate()).isEqualTo(today);
    }
}
