package br.com.fashionai.application.service;

import br.com.fashionai.application.moments.MomentDays;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.Scheme;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Look do Dia Vivido F1 (docs/novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md): sugestão do Contexto do Dia (propósitos a partir do
 * plano da semana, dos Momentos do dia e do dia da semana; marcas de calendário), registro com contexto e leitura.
 */
class DailyLookContextServiceTest {
    /** Segunda-feira de novembro: primavera no Brasil. */
    static final LocalDate SEGUNDA = LocalDate.of(2026, 11, 23);

    Kit kit;
    World world;
    DailyLookContextService service;
    DailyLookService dailyLooks;
    CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        kit.real(MomentDays.class);
        service = kit.real(DailyLookContextService.class);
        dailyLooks = kit.real(DailyLookService.class);
        ana = Kit.as(world.me);
        world.piecesOf(world.me).forEach(w -> {
            w.setDisponivel(true);
            w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        });
    }

    Moment momento(String slug, MomentType type, LocalDate from, LocalDate to) {
        Moment m = new Moment();
        m.setSlug(slug);
        m.setName("Momento " + slug);
        m.setType(type);
        m.setStartAt(Instant.parse(from + "T03:00:00Z"));
        m.setEndAt(Instant.parse(to + "T23:59:00Z"));
        m.setStatus(MomentStatus.ACTIVE);
        m.setStyleTags("streetwear,basic");
        m.setColorTags("white,black");
        m.setOccasionTags("casual");
        m.setThemeJson("{\"icon\":\"🎃\"}");
        return kit.dep(MomentRepository.class).save(m);
    }

    void planejado(LocalDate day, String eventLabel, String occasion) {
        WeekPlan plan = new WeekPlan();
        plan.setUser(world.me);
        plan.setWeekStart(day.minusDays(day.getDayOfWeek().getValue() - 1));
        plan.setStatus(WeekPlanStatus.ACTIVE);
        kit.dep(WeekPlanRepository.class).save(plan);
        WeekPlanDay d = new WeekPlanDay();
        d.setWeekPlan(plan);
        d.setDayDate(day);
        d.setEventLabel(eventLabel);
        d.setOccasion(occasion);
        kit.dep(WeekPlanDayRepository.class).save(d);
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> marks(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("marks");
    }

    @SuppressWarnings("unchecked")
    static List<String> codes(Object rows) {
        return ((List<Map<String, Object>>) rows).stream().map(r -> String.valueOf(r.get("code"))).toList();
    }

    @Test
    void sugereOContextoDoDiaComPlanoDaSemanaMomentoEDiaDaSemana() {
        planejado(SEGUNDA, "Entrevista na agência", "work");
        momento("denim-week", MomentType.CULTURAL, SEGUNDA.minusDays(1), SEGUNDA.plusDays(3));
        momento("verao-2027", MomentType.SEASONAL, SEGUNDA.plusDays(10), SEGUNDA.plusDays(60));   // ainda não começou: fora do dia
        when(kit.dep(WeatherService.class).resolve(any(), any(), any()))
                .thenReturn(new WeatherService.Context(9.4, "chuva", "São Paulo", "INVERNO_PESADO", "WINTER", null, true));

        Map<String, Object> out = service.suggest(ana, SEGUNDA, -23.5, -46.6, null);

        assertThat(out).containsEntry("date", SEGUNDA);
        assertThat((String) out.get("prompt")).isNotBlank();
        List<Map<String, Object>> marks = marks(out);
        assertThat(marks.stream().map(m -> m.get("kind"))).containsExactly("WEEKDAY", "SEASON", "WEATHER", "MOMENT");
        assertThat(marks.get(0)).containsEntry("code", "MONDAY").containsEntry("weekend", false);
        assertThat((String) marks.get(0).get("label")).isEqualTo("Segunda-feira");
        assertThat(marks.get(1)).containsEntry("code", "SPRING").containsEntry("label", "Primavera");   // hemisfério sul
        assertThat(marks.get(2)).containsEntry("code", "INVERNO_PESADO").containsEntry("label", "9 °C · chuva");
        assertThat(marks.get(3)).containsEntry("code", "denim-week").containsEntry("label", "Momento denim-week").containsEntry("type", "CULTURAL").containsEntry("icon", "🎃");
        // plano da semana primeiro (rótulo "entrevista", ocasião "work"), depois o Momento cultural (festa); 3 no máximo
        assertThat(codes(out.get("suggestedPurposes"))).containsExactly("ENTREVISTA", "TRABALHO_PRESENCIAL", "FESTA");
        assertThat(codes(out.get("purposes"))).hasSize(DailyLookPurpose.values().length).contains("CUIDADO");
        assertThat(codes(out.get("audiences"))).hasSize(DailyLookAudience.values().length);
        assertThat((Map<String, Object>) out.get("weekPlanDay")).containsEntry("eventLabel", "Entrevista na agência").containsEntry("occasion", "work");
    }

    @Test
    void semLocalNaoHaMarcaDeClimaEFimDeSemanaSugereLazer() {
        LocalDate sabado = SEGUNDA.plusDays(5);
        Map<String, Object> out = service.suggest(ana, sabado, null, null, null);
        assertThat(marks(out).stream().map(m -> m.get("kind"))).containsExactly("WEEKDAY", "SEASON");
        assertThat(marks(out).get(0)).containsEntry("code", "SATURDAY").containsEntry("weekend", true);
        assertThat(codes(out.get("suggestedPurposes"))).containsExactly("LAZER", "ESTUDO", "HOME_OFFICE");
        assertThat(out.get("weekPlanDay")).isNull();
    }

    @Test
    void estacaoDependeDoHemisferioEPalavrasDoPlanoViramProposito() {
        assertThat(DailyLookContextService.season(LocalDate.of(2026, 11, 23), "BR")).isEqualTo("SPRING");
        assertThat(DailyLookContextService.season(LocalDate.of(2026, 11, 23), "PT")).isEqualTo("AUTUMN");
        assertThat(DailyLookContextService.season(LocalDate.of(2026, 1, 10), "BR")).isEqualTo("SUMMER");
        assertThat(DailyLookContextService.season(LocalDate.of(2026, 1, 10), null)).isEqualTo("WINTER");
        assertThat(DailyLookContextService.season(LocalDate.of(2026, 7, 10), "AR")).isEqualTo("WINTER");
        assertThat(DailyLookContextService.season(LocalDate.of(2026, 4, 10), "ZA")).isEqualTo("AUTUMN");
        assertThat(DailyLookPurposeWords.from("Reunião com cliente")).contains(DailyLookPurpose.TRABALHO_PRESENCIAL);
        assertThat(DailyLookPurposeWords.from("Casamento da Lu")).contains(DailyLookPurpose.CERIMONIA);
        assertThat(DailyLookPurposeWords.from("Primeiro dia no estágio")).contains(DailyLookPurpose.PRIMEIRO_DIA);
        assertThat(DailyLookPurposeWords.from("formal")).contains(DailyLookPurpose.CERIMONIA);
        assertThat(DailyLookPurposeWords.from("")).isEmpty();
        assertThat(DailyLookPurposeWords.from(null)).isEmpty();
    }

    @Test
    void registraOLookDoDiaComContextoECongelaAsMarcasDoDia() {
        momento("halloween", MomentType.CULTURAL, SEGUNDA.minusDays(3), SEGUNDA.plusDays(1));
        Scheme look = world.looksOf(world.me).get(0);
        DailyLookContext ctx = new DailyLookContext(DailyLookPurpose.ENTREVISTA, "  Vaga de designer na agência  ", DailyLookAudience.TRABALHO, null, null, null);

        DailyLook dl = dailyLooks.register(ana, look, DailyLookSource.MANUAL, SEGUNDA, ctx);

        assertThat(dl.getPurpose()).isEqualTo(DailyLookPurpose.ENTREVISTA);
        assertThat(dl.getPurposeNote()).isEqualTo("Vaga de designer na agência");
        assertThat(dl.getAudience()).isEqualTo(DailyLookAudience.TRABALHO);
        assertThat(dl.getCalendarMarksJson()).contains("\"halloween\"").contains("\"MONDAY\"");
        Map<String, Object> v = dailyLooks.view(dl);
        @SuppressWarnings("unchecked") Map<String, Object> c = (Map<String, Object>) v.get("context");
        assertThat(c).containsEntry("purpose", "ENTREVISTA").containsEntry("purposeLabel", "Entrevista").containsEntry("audienceLabel", "Trabalho")
                .containsEntry("sensitive", false).containsEntry("privateOnly", false);
        assertThat(codes(c.get("marks"))).containsExactly("MONDAY", "SPRING", "halloween");

        // sem contexto, a leitura continua como antes (context nulo) e o registro antigo não é tocado
        DailyLook outro = dailyLooks.register(ana, world.looksOf(world.me).get(1), DailyLookSource.AUTOPILOTO, SEGUNDA.plusDays(1));
        assertThat(dailyLooks.view(outro)).containsEntry("context", null);
        assertThat(dl.getPurpose()).isEqualTo(DailyLookPurpose.ENTREVISTA);
    }

    @Test
    void propositoSensivelEPublicoSoEuFicamMarcadosNaLeitura() {
        Scheme look = world.looksOf(world.me).get(0);
        DailyLook dl = dailyLooks.register(ana, look, DailyLookSource.MANUAL, SEGUNDA,
                new DailyLookContext(DailyLookPurpose.CUIDADO, null, DailyLookAudience.SO_EU, null, null, null));
        @SuppressWarnings("unchecked") Map<String, Object> c = (Map<String, Object>) dailyLooks.view(dl).get("context");
        assertThat(c).containsEntry("sensitive", true).containsEntry("privateOnly", true).containsEntry("purposeNote", null);
        assertThat(new DailyLookContext(null, "   ", null, null, null, null).empty()).isTrue();
        assertThat(new DailyLookContext(null, "x".repeat(200), null, null, null, null).note()).hasSize(DailyLookContext.NOTE_MAX);
    }
}
