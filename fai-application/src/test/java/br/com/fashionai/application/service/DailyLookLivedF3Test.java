package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.moments.MomentDays;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.WeekPlan;
import br.com.fashionai.domain.model.WeekPlanDay;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.DailyLookAudience;
import br.com.fashionai.domain.model.enums.DailyLookPurpose;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.WeekPlanStatus;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.WeekPlanDayRepository;
import br.com.fashionai.domain.repository.WeekPlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Look do Dia Vivido F3: fase pessoal como Momento PERSONAL privado (criação, dias ligados, Memória com as peças que mais
 * acompanharam, publicação no perfil), "mesma data, outro ano" e o convite da véspera.
 */
class DailyLookLivedF3Test {
    static final LocalDate SEG = LocalDate.of(2026, 11, 2);

    Kit kit;
    World world;
    DailyLookService dailyLooks;
    DailyLookPhaseService phases;
    DailyLookMemoryService memory;
    CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        kit.real(MomentDays.class);
        kit.real(DailyLookContextService.class);
        kit.real(DailyLookPhaseMemory.class);
        phases = kit.real(DailyLookPhaseService.class);
        dailyLooks = kit.real(DailyLookService.class);
        memory = kit.build(DailyLookMemoryService.class);
        ana = Kit.as(world.me);
        world.piecesOf(world.me).forEach(w -> {
            w.setDisponivel(true);
            w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        });
    }

    DailyLook wear(int look, LocalDate day, DailyLookPurpose p) {
        return dailyLooks.register(ana, world.looksOf(world.me).get(look), DailyLookSource.MANUAL, day, new DailyLookContext(p, null, DailyLookAudience.PUBLICO, null, null, null));
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> rows(Map<String, Object> m, String key) {
        return (List<Map<String, Object>>) m.get(key);
    }

    @Test
    void fasePessoalLigaOsDiasVividosEMontaAMemoria() {
        wear(0, SEG.minusDays(1), DailyLookPurpose.TRABALHO_PRESENCIAL);   // antes da fase: fora
        wear(0, SEG, DailyLookPurpose.PRIMEIRO_DIA);                       // já registrado: entra ao criar
        Map<String, Object> fase = phases.create(ana, "  Primeiro mês no novo emprego ", SEG, SEG.plusDays(29));
        assertThat(fase).containsEntry("name", "Primeiro mês no novo emprego").containsEntry("startDate", SEG).containsEntry("endDate", SEG.plusDays(29)).containsEntry("publicOnProfile", false).containsEntry("status", "ACTIVE");
        UUID id = (UUID) fase.get("id");
        Moment m = kit.dep(MomentRepository.class).findById(id).orElseThrow();
        assertThat(m.getType()).isEqualTo(MomentType.PERSONAL);
        assertThat(m.getVisibility().name()).isEqualTo("PRIVATE");
        assertThat(m.isPointsEnabled()).isFalse();
        assertThat(phases.phaseOn(world.me.getId(), SEG.plusDays(3))).isPresent();
        assertThat(phases.phaseOn(world.me.getId(), SEG.plusDays(40))).isEmpty();

        DailyLook d2 = wear(1, SEG.plusDays(1), DailyLookPurpose.TRABALHO_PRESENCIAL);   // durante a fase: liga sozinho
        wear(0, SEG.plusDays(2), DailyLookPurpose.CUIDADO);
        assertThat(d2.getPersonalMomentId()).isEqualTo(id);
        assertThat(dailyLooks.view(d2)).containsEntry("personalMomentId", id);

        Map<String, Object> mem = phases.memory(ana, id);
        assertThat(mem).containsEntry("totalDays", 30L).containsEntry("daysWithLook", 3L).containsEntry("looks", 2L);
        assertThat((Map<String, Integer>) mem.get("purposes")).containsEntry("Primeiro dia", 1).containsEntry("Trabalho presencial", 1).doesNotContainKey("Dia de cuidado");
        List<Map<String, Object>> top = rows(mem, "topPieces");
        assertThat(top).isNotEmpty().hasSizeLessThanOrEqualTo(DailyLookPhaseMemory.TOP_PIECES);
        assertThat((Integer) top.get(0).get("times")).isGreaterThanOrEqualTo(2);   // peças do look 0, vestido 2×
        assertThat(rows(mem, "days")).hasSize(3).first().satisfies(d -> assertThat(d).containsEntry("purposeLabel", "Primeiro dia"));
        assertThat(phases.mine(ana)).hasSize(1).first().satisfies(f -> assertThat(f).containsEntry("daysWithLook", 3L));

        // validações
        assertThatThrownBy(() -> phases.create(ana, " ", SEG, SEG)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> phases.create(ana, "x", SEG, SEG.minusDays(1))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> phases.create(ana, "x", SEG, SEG.plusDays(400))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> phases.memory(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void publicarAMemoriaNoPerfilEAtoExplicitoESoLevaPecasPublicas() {
        wear(0, SEG, DailyLookPurpose.ESTUDO);
        UUID id = (UUID) phases.create(ana, "Semana de provas", SEG, SEG.plusDays(6)).get("id");
        Guard guard = kit.dep(Guard.class);
        when(guard.canView(any(), any(), any())).thenReturn(true);
        CurrentUser bia = Kit.as(world.rival);
        assertThat(phases.published(bia, world.me.getId())).isEmpty();
        assertThat(phases.setPublicOnProfile(ana, id, true)).containsEntry("publicOnProfile", true);
        world.piecesOf(world.me).get(0).setVisibility(br.com.fashionai.domain.model.enums.Visibility.PRIVATE);
        List<Map<String, Object>> pub = phases.published(bia, world.me.getId());
        assertThat(pub).hasSize(1);
        assertThat(pub.get(0)).containsEntry("name", "Semana de provas").containsEntry("daysWithLook", 1L).doesNotContainKey("days");
        assertThat(rows(pub.get(0), "topPieces")).noneMatch(p -> p.get("id").equals(world.piecesOf(world.me).get(0).getId()));
        when(guard.canView(any(), any(), any())).thenReturn(false);
        assertThat(phases.published(bia, world.me.getId())).isEmpty();
    }

    @Test
    void mesmaDataOutroAno() {
        wear(0, SEG.minusYears(1), DailyLookPurpose.ENTREVISTA);
        wear(1, SEG.minusYears(3), DailyLookPurpose.FESTA);
        wear(2, SEG.minusYears(7), DailyLookPurpose.FESTA);   // além de 5 anos: fora
        List<Map<String, Object>> items = rows(memory.onThisDay(ana, SEG), "items");
        assertThat(items).extracting(i -> i.get("yearsAgo")).containsExactly(1, 3);
        assertThat((Map<String, Object>) items.get(0).get("context")).containsEntry("purposeLabel", "Entrevista");
    }

    @Test
    void conviteDaVesperaVemDoPlanoDaSemanaOuDeMomentoQueComecaAmanha() {
        assertThat(memory.tomorrow(ana, SEG)).isNull();
        WeekPlan plan = new WeekPlan();
        plan.setUser(world.me);
        plan.setWeekStart(SEG);
        plan.setStatus(WeekPlanStatus.ACTIVE);
        kit.dep(WeekPlanRepository.class).save(plan);
        WeekPlanDay d = new WeekPlanDay();
        d.setWeekPlan(plan);
        d.setDayDate(SEG.plusDays(1));
        d.setEventLabel("Apresentação para a diretoria");
        kit.dep(WeekPlanDayRepository.class).save(d);
        Map<String, Object> conv = memory.tomorrow(ana, SEG);
        assertThat(conv).containsEntry("date", SEG.plusDays(1)).containsEntry("event", "Apresentação para a diretoria").containsEntry("hasLook", false).containsEntry("prepareHref", "/autopilot");
        assertThat((String) conv.get("message")).contains("Apresentação para a diretoria");

        Moment m = new Moment();
        m.setSlug("denim-week");
        m.setName("Denim Week");
        m.setStartAt(Instant.parse("2026-11-05T03:00:00Z"));
        m.setEndAt(Instant.parse("2026-11-09T23:00:00Z"));
        m.setStatus(MomentStatus.SCHEDULED);
        kit.dep(MomentRepository.class).save(m);
        Map<String, Object> momento = memory.tomorrow(ana, SEG.plusDays(2));
        assertThat(momento).containsEntry("event", null).containsEntry("prepareHref", "/moments/denim-week");
        assertThat(rows(momento, "moments")).hasSize(1).first().satisfies(mk -> assertThat(mk).containsEntry("code", "denim-week"));
        assertThat(memory.tomorrow(ana, SEG.plusDays(3))).isNull();   // já começou: não é véspera
    }
}
