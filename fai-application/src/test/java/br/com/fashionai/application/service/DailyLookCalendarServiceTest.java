package br.com.fashionai.application.service;

import br.com.fashionai.application.moments.MomentDays;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.DailyLookAudience;
import br.com.fashionai.domain.model.enums.DailyLookPurpose;
import br.com.fashionai.domain.model.enums.DailyLookSource;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import br.com.fashionai.domain.repository.MomentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Look do Dia Vivido F1 — o Look do Dia no calendário de Momentos: cada dia com registro traz o look, o contexto e a
 * coerência (MomentMatch) com os Momentos, desafios e eventos daquele dia; propósito sensível não é pontuado.
 */
class DailyLookCalendarServiceTest {
    static final LocalDate SEG = LocalDate.of(2026, 11, 23);

    Kit kit;
    World world;
    DailyLookService dailyLooks;
    DailyLookCalendarService service;
    CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        kit.real(MomentDays.class);
        kit.real(DailyLookContextService.class);
        dailyLooks = kit.real(DailyLookService.class);
        service = kit.build(DailyLookCalendarService.class);
        ana = Kit.as(world.me);
        world.piecesOf(world.me).forEach(w -> {
            w.setDisponivel(true);
            w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        });
    }

    Moment momento(String slug, MomentType type, LocalDate from, LocalDate to, String styles, String colors, String occasions, MomentVisibility vis) {
        Moment m = new Moment();
        m.setSlug(slug);
        m.setName("Momento " + slug);
        m.setType(type);
        m.setStartAt(Instant.parse(from + "T03:00:00Z"));
        m.setEndAt(Instant.parse(to + "T23:59:00Z"));
        m.setStatus(MomentStatus.ACTIVE);
        m.setVisibility(vis);
        m.setCreatedByUserId(UUID.randomUUID());
        m.setStyleTags(styles);
        m.setColorTags(colors);
        m.setOccasionTags(occasions);
        return kit.dep(MomentRepository.class).save(m);
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> rows(Map<String, Object> out, String key) {
        return (List<Map<String, Object>>) out.get(key);
    }

    @Test
    void cadaDiaComLookTrazOContextoEACoerenciaComOsMomentosDoDia() {
        momento("denim-week", MomentType.COMMUNITY, SEG.minusDays(1), SEG.plusDays(2), "streetwear,basic", "white,black", "casual", MomentVisibility.PUBLIC);
        momento("gala", MomentType.EVENT, SEG, SEG, "glam,romantic", "gold,silver", "formal", MomentVisibility.PUBLIC);
        momento("secreto", MomentType.PRIVATE_GROUP, SEG, SEG, "streetwear", "white", "casual", MomentVisibility.PRIVATE);   // de outro grupo: invisível
        dailyLooks.register(ana, world.looksOf(world.me).get(0), DailyLookSource.MANUAL, SEG,
                new DailyLookContext(DailyLookPurpose.ENTREVISTA, "agência", DailyLookAudience.TRABALHO, null, null, null));
        dailyLooks.register(ana, world.looksOf(world.me).get(1), DailyLookSource.MANUAL, SEG.plusDays(1),
                new DailyLookContext(DailyLookPurpose.CUIDADO, null, DailyLookAudience.SO_EU, null, null, null));
        dailyLooks.register(ana, world.looksOf(world.me).get(2), DailyLookSource.AUTOPILOTO, SEG.plusDays(10));
        dailyLooks.register(ana, world.looksOf(world.me).get(2), DailyLookSource.AUTOPILOTO, LocalDate.of(2027, 1, 5));   // outro ano

        Map<String, Object> out = service.calendar(ana, 2026, null);

        List<Map<String, Object>> days = rows(out, "days");
        assertThat(days).extracting(d -> d.get("date")).containsExactly(SEG, SEG.plusDays(1), SEG.plusDays(10));
        // segunda: entrevista; o look streetwear conversa com a Denim Week (match ≥ 40) e não com a gala
        Map<String, Object> seg = days.get(0);
        @SuppressWarnings("unchecked") Map<String, Object> dl = (Map<String, Object>) seg.get("dailyLook");
        @SuppressWarnings("unchecked") Map<String, Object> ctx = (Map<String, Object>) dl.get("context");
        assertThat(ctx).containsEntry("purposeLabel", "Entrevista");
        List<Map<String, Object>> moments = rows(seg, "moments");
        assertThat(moments).extracting(m -> m.get("code")).containsExactly("denim-week", "gala");
        assertThat((Integer) moments.get(0).get("match")).isGreaterThanOrEqualTo(MomentDays.COHERENT_FROM);
        assertThat(moments.get(0)).containsEntry("coherent", true).containsEntry("type", "COMMUNITY");
        assertThat((Integer) moments.get(1).get("match")).isLessThan(MomentDays.COHERENT_FROM);
        assertThat(moments.get(1)).containsEntry("coherent", false);
        assertThat(seg).containsEntry("coherent", true);
        // terça: dia de cuidado — o Momento aparece como marca, sem match nem coerência
        Map<String, Object> ter = days.get(1);
        assertThat(rows(ter, "moments")).hasSize(1).first().satisfies(m -> {
            assertThat(m).containsEntry("code", "denim-week").doesNotContainKey("match").doesNotContainKey("coherent");
        });
        assertThat(ter).containsEntry("coherent", false);
        // dia sem Momento
        assertThat(rows(days.get(2), "moments")).isEmpty();
        assertThat((Map<String, Object>) out.get("summary")).containsEntry("days", 3).containsEntry("coherentDays", 1);

        // filtro por mês e ano sem registros
        assertThat(rows(service.calendar(ana, 2026, 12), "days")).extracting(d -> d.get("date")).containsExactly(SEG.plusDays(10));
        assertThat(rows(service.calendar(ana, 2025, null), "days")).isEmpty();
    }
}
