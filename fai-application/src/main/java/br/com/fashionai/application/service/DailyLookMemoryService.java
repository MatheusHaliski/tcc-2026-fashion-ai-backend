package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentDays;
import br.com.fashionai.application.moments.MomentTime;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.WeekPlanDay;
import br.com.fashionai.domain.repository.DailyLookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Look do Dia Vivido — memória e véspera (§4.3, §4.5): "mesma data, outro ano" (o look vestido nesta data em anos
 * anteriores, com o contexto da época) e o convite contextual para amanhã (evento do plano da semana ou Momento que
 * começa amanhã), sem notificação: a pergunta aparece uma vez, na aba Look do Dia.
 */
@Service
public class DailyLookMemoryService {
    static final int YEARS_BACK = 5;

    private final DailyLookRepository dailyLooks;
    private final DailyLookService service;
    private final DailyLookContextService context;
    private final MomentDays momentDays;

    public DailyLookMemoryService(DailyLookRepository dailyLooks, DailyLookService service, DailyLookContextService context, MomentDays momentDays) {
        this.dailyLooks = dailyLooks;
        this.service = service;
        this.context = context;
        this.momentDays = momentDays;
    }

    /** GET /api/me/daily-looks/on-this-day — registros da mesma data (dia e mês) nos últimos 5 anos, do mais recente ao mais antigo. */
    @Transactional(readOnly = true)
    public Map<String, Object> onThisDay(CurrentUser user, LocalDate date) {
        LocalDate day = date == null ? LocalDate.now(FaiPointsService.ZONE) : date;
        List<Map<String, Object>> items = new ArrayList<>();
        for (int k = 1; k <= YEARS_BACK; k++) {
            int years = k;
            dailyLooks.findByUserIdAndLookDate(user.id(), day.minusYears(k)).ifPresent(dl -> {
                Map<String, Object> row = new LinkedHashMap<>(service.view(dl));
                row.put("yearsAgo", years);
                items.add(row);
            });
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", day);
        out.put("items", items);
        return out;
    }

    /** GET /api/me/daily-looks/tomorrow — o que a pessoa vive amanhã e se já há look preparado; nulo quando não há nada. */
    @Transactional(readOnly = true)
    public Map<String, Object> tomorrow(CurrentUser user, LocalDate date) {
        LocalDate day = (date == null ? LocalDate.now(FaiPointsService.ZONE) : date).plusDays(1);
        Optional<WeekPlanDay> planned = context.plannedDay(user, day).filter(d -> d.getEventLabel() != null && !d.getEventLabel().isBlank());
        List<Moment> starting = momentDays.on(user, day).stream().filter(m -> day.equals(MomentTime.localStart(m))).toList();
        if (planned.isEmpty() && starting.isEmpty()) {
            return null;
        }
        String what = planned.map(WeekPlanDay::getEventLabel).orElseGet(() -> (String) MomentDays.mark(starting.get(0)).get("label"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", day);
        out.put("event", planned.map(WeekPlanDay::getEventLabel).orElse(null));
        out.put("weekPlanDayId", planned.map(WeekPlanDay::getId).orElse(null));
        out.put("moments", starting.stream().map(MomentDays::mark).toList());
        out.put("hasLook", dailyLooks.findByUserIdAndLookDate(user.id(), day).isPresent());
        out.put("message", Msg.t("dailyLook.amanha_e_quer_preparar", what));
        out.put("prepareHref", planned.isPresent() ? "/autopilot" : "/moments/" + starting.get(0).getSlug());
        return out;
    }
}
