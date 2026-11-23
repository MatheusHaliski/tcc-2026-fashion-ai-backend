package br.com.fashionai.application.service;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.moments.MomentDays;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.DailyLookAudience;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.DailyLookPurpose;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.repository.DailyLookRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Look do Dia Vivido F2: "quem mais está vivendo isso hoje" (mesmo propósito, mesma data, ≥ 5 pessoas; sensível e "só eu"
 * fora), "deu certo?" com nota e o sinal LOOK_WORKED, selo de experiência do look, marco "Semana vestida" e o filtro da
 * Passarela por propósito.
 */
class DailyLookLivedF2Test {
    /** Segunda-feira no passado (nunca "hoje": o teste de pendência usa a data real). */
    static final LocalDate SEG = LocalDate.of(2026, 11, 2);

    Kit kit;
    World world;
    DailyLookService dailyLooks;
    DailyLookLivingTodayService living;
    DailyLookExperienceService experience;
    CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        kit.real(MomentDays.class);
        kit.real(DailyLookContextService.class);
        experience = kit.real(DailyLookExperienceService.class);
        dailyLooks = kit.real(DailyLookService.class);
        living = kit.build(DailyLookLivingTodayService.class);
        ana = Kit.as(world.me);
        kit.dep(br.com.fashionai.domain.repository.WardrobeItemRepository.class).findAll().forEach(w -> {
            w.setDisponivel(true);
            w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        });
    }

    static DailyLookContext ctx(DailyLookPurpose p, DailyLookAudience a) {
        return new DailyLookContext(p, null, a, null, null, null);
    }

    DailyLook wear(User u, int look, LocalDate day, DailyLookPurpose p, DailyLookAudience a) {
        return dailyLooks.register(Kit.as(u), world.looksOf(u).get(look), DailyLookSource.MANUAL, day, ctx(p, a));
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> looks(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("looks");
    }

    @Test
    void quemMaisEstaVivendoIssoHojeSoAparececomCincoPessoasENuncaSensivelOuSoEu() {
        wear(world.me, 0, SEG, DailyLookPurpose.ENTREVISTA, DailyLookAudience.TRABALHO);
        List<User> outros = List.of(world.rival, world.friend, world.person("fabi", 2), world.person("gabi", 2), world.person("heitor", 2), world.person("iris", 2));
        for (int i = 0; i < 4; i++) {
            wear(outros.get(i), 0, SEG, DailyLookPurpose.ENTREVISTA, DailyLookAudience.PUBLICO);
        }
        wear(outros.get(4), 0, SEG, DailyLookPurpose.ENTREVISTA, DailyLookAudience.SO_EU);   // "só eu": nunca entra
        wear(outros.get(5), 0, SEG, DailyLookPurpose.FESTA, DailyLookAudience.PUBLICO);        // outro propósito
        Map<String, Object> poucos = living.livingToday(ana, SEG);
        assertThat(poucos).containsEntry("purposeLabel", "Entrevista").containsEntry("count", 4).containsEntry("enough", false).containsEntry("hidden", false);
        assertThat(looks(poucos)).isEmpty();

        wear(outros.get(4), 1, SEG, DailyLookPurpose.ENTREVISTA, DailyLookAudience.AMIGOS);   // trocou: agora conta
        Map<String, Object> cinco = living.livingToday(ana, SEG);
        assertThat(cinco).containsEntry("count", 5).containsEntry("enough", true);
        assertThat(looks(cinco)).hasSize(5).allSatisfy(c -> assertThat(c).containsKeys("schemeId", "title", "owner", "worked"));
        assertThat(looks(cinco)).noneMatch(c -> ((Map<String, Object>) c.get("owner")).get("id").equals(world.me.getId()));

        // dia de cuidado: fica só com a pessoa (hidden), mesmo havendo outras
        wear(world.me, 1, SEG, DailyLookPurpose.CUIDADO, DailyLookAudience.PUBLICO);
        assertThat(living.livingToday(ana, SEG)).containsEntry("hidden", true).containsEntry("count", 0);
        // sem propósito: nada
        dailyLooks.register(ana, world.looksOf(world.me).get(2), DailyLookSource.AUTOPILOTO, SEG.plusDays(1));
        assertThat(living.livingToday(ana, SEG.plusDays(1))).containsEntry("purpose", null).containsEntry("count", 0);
    }

    @Test
    void deuCertoComNotaViraSinalLookWorkedSoEmPropositoNaoSensivel() {
        Scheme look = world.looksOf(world.me).get(0);
        wear(world.me, 0, SEG, DailyLookPurpose.ENTREVISTA, DailyLookAudience.TRABALHO);
        Map<String, Object> v = dailyLooks.feedback(ana, SEG, DailyLookFeedback.ADOREI, "  A entrevista foi bem  ");
        assertThat(v).containsEntry("outcomeNote", "A entrevista foi bem").containsEntry("feedback", "ADOREI");
        ArgumentCaptor<Object> ev = ArgumentCaptor.forClass(Object.class);
        verify(kit.dep(ApplicationEventPublisher.class), atLeastOnce()).publishEvent(ev.capture());
        assertThat(ev.getAllValues()).anySatisfy(e -> {
            assertThat(e).isInstanceOf(DomainEvents.DailyLookWorked.class);
            assertThat(((DomainEvents.DailyLookWorked) e).schemeId()).isEqualTo(look.getId());
            assertThat(((DomainEvents.DailyLookWorked) e).purpose()).isEqualTo("ENTREVISTA");
        });
        // a pergunta do fim do dia leva o contexto
        assertThat((String) dailyLooks.pendingFeedback(ana).get("message")).isEmpty();   // já avaliado
        wear(world.me, 1, LocalDate.now(FaiPointsService.ZONE), DailyLookPurpose.APRESENTACAO, null);
        assertThat((String) dailyLooks.pendingFeedback(ana).get("message")).contains("apresentação");

        // sensível: sem sinal
        kit.dep(DailyLookRepository.class).findByUserIdAndLookDate(world.me.getId(), SEG).orElseThrow().setPurpose(DailyLookPurpose.CUIDADO);
        org.mockito.Mockito.clearInvocations(kit.dep(ApplicationEventPublisher.class));
        dailyLooks.feedback(ana, SEG, DailyLookFeedback.ADOREI, null);
        verify(kit.dep(ApplicationEventPublisher.class), never()).publishEvent(any(DomainEvents.DailyLookWorked.class));
    }

    @Test
    void seloDeExperienciaContaUsosEAcertosPorProposito() {
        Scheme look = world.looksOf(world.me).get(0);
        wear(world.me, 0, SEG, DailyLookPurpose.ENTREVISTA, null);
        dailyLooks.feedback(ana, SEG, DailyLookFeedback.ADOREI, null);
        wear(world.me, 0, SEG.plusDays(2), DailyLookPurpose.ENTREVISTA, null);
        dailyLooks.feedback(ana, SEG.plusDays(2), DailyLookFeedback.NAO_GOSTEI, null);
        wear(world.me, 0, SEG.plusDays(9), DailyLookPurpose.ENTREVISTA, null);
        dailyLooks.feedback(ana, SEG.plusDays(9), DailyLookFeedback.ADOREI, null);
        wear(world.me, 0, SEG.plusDays(3), DailyLookPurpose.FESTA, null);
        wear(world.me, 0, SEG.plusDays(4), DailyLookPurpose.CUIDADO, null);   // sensível: fora do selo
        wear(world.rival, 0, SEG, DailyLookPurpose.ENTREVISTA, null);          // de outra pessoa: fora
        List<Map<String, Object>> rows = experience.experience(ana, look.getId());
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0)).containsEntry("purpose", "ENTREVISTA").containsEntry("label", "Entrevista").containsEntry("times", 3).containsEntry("worked", 2);
        assertThat(rows.get(1)).containsEntry("purpose", "FESTA").containsEntry("times", 1).containsEntry("worked", 0);
    }

    @Test
    void semanaVestidaDeSegundaASextaComPropositoDeTrabalhoOuEstudo() {
        AchievementService achievements = kit.dep(AchievementService.class);
        when(achievements.grant(any(), eq(DailyLookExperienceService.WEEK_ACHIEVEMENT))).thenReturn(true);
        DailyLookPurpose[] semana = {DailyLookPurpose.TRABALHO_PRESENCIAL, DailyLookPurpose.HOME_OFFICE, DailyLookPurpose.ESTUDO, DailyLookPurpose.ENTREVISTA};
        for (int i = 0; i < 4; i++) {
            wear(world.me, i % 3, SEG.plusDays(i), semana[i], null);
        }
        wear(world.me, 0, SEG.plusDays(5), DailyLookPurpose.LAZER, null);   // sábado não conta
        verify(achievements, never()).grant(any(), eq(DailyLookExperienceService.WEEK_ACHIEVEMENT));
        wear(world.me, 1, SEG.plusDays(4), DailyLookPurpose.FESTA, null);   // sexta com festa: ainda não
        verify(achievements, never()).grant(any(), eq(DailyLookExperienceService.WEEK_ACHIEVEMENT));
        wear(world.me, 1, SEG.plusDays(4), DailyLookPurpose.APRESENTACAO, null);
        verify(achievements).grant(world.me.getId(), DailyLookExperienceService.WEEK_ACHIEVEMENT);
    }

    @Test
    void filtroDaPassarelaPorPropositoEDeuCerto() {
        DailyLook ok = wear(world.me, 0, SEG, DailyLookPurpose.ENTREVISTA, DailyLookAudience.PUBLICO);
        ShowcaseService.RunwayFilter todos = new ShowcaseService.RunwayFilter(null, null, null, List.of(), List.of(), List.of(), null, 6, 0, null, null);
        ShowcaseService.RunwayFilter entrevista = new ShowcaseService.RunwayFilter(null, null, null, List.of(), List.of(), List.of(), null, 6, 0, "entrevista", null);
        ShowcaseService.RunwayFilter deuCerto = new ShowcaseService.RunwayFilter(null, null, null, List.of(), List.of(), List.of(), null, 6, 0, "ENTREVISTA", true);
        assertThat(RunwayPurpose.matches(ok, todos)).isTrue();
        assertThat(RunwayPurpose.matches(ok, entrevista)).isTrue();
        assertThat(RunwayPurpose.matches(ok, deuCerto)).isFalse();
        dailyLooks.feedback(ana, SEG, DailyLookFeedback.ADOREI, null);
        assertThat(RunwayPurpose.matches(ok, deuCerto)).isTrue();
        ok.setAudience(DailyLookAudience.SO_EU);
        assertThat(RunwayPurpose.matches(ok, entrevista)).isFalse();
        ok.setAudience(DailyLookAudience.PUBLICO);
        ok.setPurpose(DailyLookPurpose.CUIDADO);
        assertThat(RunwayPurpose.matches(ok, new ShowcaseService.RunwayFilter(null, null, null, List.of(), List.of(), List.of(), null, 6, 0, "CUIDADO", null))).isFalse();
        assertThat(RunwayPurpose.matches(ok, new ShowcaseService.RunwayFilter(null, null, null, List.of(), List.of(), List.of(), null, 6, 0, "INVENTADO", null))).isFalse();
    }
}
