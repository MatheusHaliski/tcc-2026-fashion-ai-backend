package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentDays;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WeekPlanDay;
import br.com.fashionai.domain.model.enums.DailyLookAudience;
import br.com.fashionai.domain.model.enums.DailyLookPurpose;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.WeekPlanStatus;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WeekPlanDayRepository;
import br.com.fashionai.domain.repository.WeekPlanRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Look do Dia Vivido F1 (docs/novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md §3, §5, §6): o Contexto do Dia de um Look do Dia.
 * Sugere propósitos a partir do que o app já sabe (plano da semana do Autopiloto, Momentos do dia, dia da semana),
 * congela no registro as marcas do calendário (dia da semana, estação, clima, Momentos) e devolve a leitura do contexto.
 * Sem IA no caminho: tudo é tabela, calendário e taxonomia.
 */
@Service
public class DailyLookContextService {
    /** Países do hemisfério sul (estação invertida em relação ao mês). */
    static final Set<String> SOUTH = Set.of("BR", "AR", "CL", "UY", "PY", "BO", "PE", "ZA", "AU", "NZ", "MZ", "AO");
    private static final int SUGGESTIONS = 3;

    private final WeekPlanRepository weekPlans;
    private final WeekPlanDayRepository weekPlanDays;
    private final UserRepository users;
    private final WeatherService weather;
    private final MomentDays momentDays;

    public DailyLookContextService(WeekPlanRepository weekPlans, WeekPlanDayRepository weekPlanDays, UserRepository users,
                                   WeatherService weather, MomentDays momentDays) {
        this.weekPlans = weekPlans;
        this.weekPlanDays = weekPlanDays;
        this.users = users;
        this.weather = weather;
        this.momentDays = momentDays;
    }

    /** GET /api/me/daily-looks/suggest-context — chips sugeridos, catálogo completo e as marcas do dia (clima só com local). */
    @Transactional(readOnly = true)
    public Map<String, Object> suggest(CurrentUser user, LocalDate date, Double latitude, Double longitude, String city) {
        LocalDate day = date == null ? LocalDate.now(FaiPointsService.ZONE) : date;
        List<Moment> moments = momentDays.on(user, day);
        Optional<WeekPlanDay> planned = plannedDay(user, day);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", day);
        out.put("prompt", Msg.t("dailyLook.hoje_eu_vesti_isso_para"));
        out.put("marks", marks(user, day, moments, latitude, longitude, city));
        out.put("suggestedPurposes", suggestedPurposes(day, planned.orElse(null), moments).stream().map(DailyLookContextService::purposeView).toList());
        out.put("purposes", Arrays.stream(DailyLookPurpose.values()).map(DailyLookContextService::purposeView).toList());
        out.put("audiences", Arrays.stream(DailyLookAudience.values()).map(DailyLookContextService::audienceView).toList());
        out.put("weekPlanDay", planned.map(d -> Map.<String, Object>of("id", d.getId(), "eventLabel", d.getEventLabel() == null ? "" : d.getEventLabel(),
                "occasion", d.getOccasion() == null ? "" : d.getOccasion())).orElse(null));
        return out;
    }

    /** Grava o contexto no registro e congela as marcas do calendário na data (clima e Momentos não mudam depois). */
    public void freeze(DailyLook dl, DailyLookContext ctx, CurrentUser user, LocalDate day) {
        dl.setPurpose(ctx.purpose());
        dl.setPurposeNote(ctx.note());
        dl.setAudience(ctx.audience());
        dl.setCalendarMarksJson(Json.write(marks(user, day, momentDays.on(user, day), ctx.latitude(), ctx.longitude(), ctx.city())));
    }

    /** Leitura do contexto para as telas (nulo quando a pessoa não contou nada e nada foi congelado). */
    public Map<String, Object> view(DailyLook dl) {
        if (dl.getPurpose() == null && dl.getPurposeNote() == null && dl.getAudience() == null && dl.getCalendarMarksJson() == null) {
            return null;
        }
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("purpose", dl.getPurpose() == null ? null : dl.getPurpose().name());
        v.put("purposeLabel", dl.getPurpose() == null ? null : Msg.t("dailyLook.purpose." + dl.getPurpose().name()));
        v.put("purposeNote", dl.getPurposeNote());
        v.put("audience", dl.getAudience() == null ? null : dl.getAudience().name());
        v.put("audienceLabel", dl.getAudience() == null ? null : Msg.t("dailyLook.audience." + dl.getAudience().name()));
        v.put("sensitive", dl.getPurpose() != null && dl.getPurpose().sensitive());
        v.put("privateOnly", dl.getAudience() != null && dl.getAudience().privateOnly());
        v.put("marks", Json.list(dl.getCalendarMarksJson()));
        return v;
    }

    /** Marcas do dia: WEEKDAY · SEASON · WEATHER (só com local) · MOMENT (um por Momento visível que toca a data). */
    List<Map<String, Object>> marks(CurrentUser user, LocalDate day, List<Moment> moments, Double latitude, Double longitude, String city) {
        List<Map<String, Object>> marks = new ArrayList<>();
        DayOfWeek dow = day.getDayOfWeek();
        String weekday = dow.getDisplayName(TextStyle.FULL, Msg.locale());
        marks.add(mark("WEEKDAY", dow.name(), Character.toUpperCase(weekday.charAt(0)) + weekday.substring(1), Map.of("weekend", dow.getValue() >= 6)));
        String season = season(day, countryOf(user));
        marks.add(mark("SEASON", season, Msg.t("dailyLook.season." + season), Map.of()));
        WeatherService.Context w = latitude == null && longitude == null && (city == null || city.isBlank()) ? null : weather.resolve(latitude, longitude, city);
        if (w != null && w.available() && w.temperatureC() != null) {
            String label = Math.round(w.temperatureC()) + " °C" + (w.description() == null || w.description().isBlank() ? "" : " · " + w.description());
            marks.add(mark("WEATHER", w.band(), label, Map.of("temperatureC", w.temperatureC())));
        }
        for (Moment m : moments) {
            marks.add(MomentDays.mark(m));
        }
        return marks;
    }

    /** Até 3 propósitos: o do plano da semana, o dos Momentos do dia (evento/data → FESTA) e o padrão do dia da semana. */
    List<DailyLookPurpose> suggestedPurposes(LocalDate day, WeekPlanDay planned, List<Moment> moments) {
        LinkedHashSet<DailyLookPurpose> out = new LinkedHashSet<>();
        if (planned != null) {
            DailyLookPurposeWords.from(planned.getEventLabel()).ifPresent(out::add);
            DailyLookPurposeWords.from(planned.getOccasion()).ifPresent(out::add);
        }
        if (moments.stream().anyMatch(m -> m.getType() == MomentType.CULTURAL || m.getType() == MomentType.EVENT || m.getType() == MomentType.FASHION_EVENT
                || m.getType() == MomentType.BRAND_EVENT)) {
            out.add(DailyLookPurpose.FESTA);
        }
        out.add(day.getDayOfWeek().getValue() >= 6 ? DailyLookPurpose.LAZER : DailyLookPurpose.TRABALHO_PRESENCIAL);
        for (DailyLookPurpose p : List.of(DailyLookPurpose.ESTUDO, DailyLookPurpose.HOME_OFFICE, DailyLookPurpose.ENCONTRO)) {
            if (out.size() >= SUGGESTIONS) {
                break;
            }
            out.add(p);
        }
        return out.stream().limit(SUGGESTIONS).toList();
    }

    /** Estação do calendário na data, pelo hemisfério do país da pessoa (Season da taxonomia §13). */
    static String season(LocalDate day, String country) {
        int m = day.getMonthValue();
        String north = m == 12 || m <= 2 ? "WINTER" : m <= 5 ? "SPRING" : m <= 8 ? "SUMMER" : "AUTUMN";
        if (country == null || !SOUTH.contains(country.toUpperCase())) {
            return north;
        }
        return switch (north) {
            case "WINTER" -> "SUMMER";
            case "SUMMER" -> "WINTER";
            case "SPRING" -> "AUTUMN";
            default -> "SPRING";
        };
    }

    Optional<WeekPlanDay> plannedDay(CurrentUser user, LocalDate day) {
        return weekPlans.findFirstByUserIdAndStatusOrderByWeekStartDesc(user.id(), WeekPlanStatus.ACTIVE)
                .flatMap(p -> weekPlanDays.findByWeekPlanIdOrderByDayDate(p.getId()).stream().filter(d -> day.equals(d.getDayDate())).findFirst());
    }

    private String countryOf(CurrentUser user) {
        return user == null ? null : users.findById(user.id()).map(User::getCountry).orElse(null);
    }

    private static Map<String, Object> mark(String kind, String code, String label, Map<String, Object> extra) {
        Map<String, Object> mk = new LinkedHashMap<>();
        mk.put("kind", kind);
        mk.put("code", code);
        mk.put("label", label);
        mk.putAll(extra);
        return mk;
    }

    static Map<String, Object> purposeView(DailyLookPurpose p) {
        return Map.of("code", p.name(), "label", Msg.t("dailyLook.purpose." + p.name()), "sensitive", p.sensitive());
    }

    static Map<String, Object> audienceView(DailyLookAudience a) {
        return Map.of("code", a.name(), "label", Msg.t("dailyLook.audience." + a.name()), "privateOnly", a.privateOnly());
    }
}
