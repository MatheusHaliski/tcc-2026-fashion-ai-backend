package br.com.fashionai.application.service;

import br.com.fashionai.application.moments.MomentDays;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Look do Dia Vivido F1 — o Look do Dia no calendário de Momentos (docs/novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md §4,
 * pedido de 19/11/2026): para cada dia do ano/mês em que a pessoa registrou um look, o card do look com o contexto e
 * a coerência (MomentMatch) com cada Momento, desafio ou evento daquele dia. Só a própria pessoa lê (rota /api/me).
 */
@Service
public class DailyLookCalendarService {
    private final DailyLookRepository dailyLooks;
    private final SchemeItemRepository schemeItems;
    private final DailyLookService service;
    private final MomentDays momentDays;

    public DailyLookCalendarService(DailyLookRepository dailyLooks, SchemeItemRepository schemeItems, DailyLookService service, MomentDays momentDays) {
        this.dailyLooks = dailyLooks;
        this.schemeItems = schemeItems;
        this.service = service;
        this.momentDays = momentDays;
    }

    /** GET /api/me/daily-looks/calendar?year[&month] — dias com Look do Dia, cada um com o contexto e os Momentos do dia. */
    @Transactional(readOnly = true)
    public Map<String, Object> calendar(CurrentUser user, int year, Integer month) {
        LocalDate from = month == null ? LocalDate.of(year, 1, 1) : YearMonth.of(year, month).atDay(1);
        LocalDate to = month == null ? LocalDate.of(year, 12, 31) : YearMonth.of(year, month).atEndOfMonth();
        List<Moment> moments = momentDays.visibleBetween(user, from, to);
        List<Map<String, Object>> days = new ArrayList<>();
        int coherentDays = 0;
        for (DailyLook dl : dailyLooks.findByUserIdAndLookDateBetweenOrderByLookDate(user.id(), from, to)) {
            List<Map<String, Object>> rows = new ArrayList<>();
            boolean sensitive = dl.getPurpose() != null && dl.getPurpose().sensitive();
            for (Moment m : moments) {
                if (MomentDays.touches(m, dl.getLookDate())) {
                    rows.add(sensitive ? MomentDays.mark(m) : MomentDays.match(m, dl.getScheme(), schemeItems.findBySchemeIdOrderBySortOrder(dl.getScheme().getId())));
                }
            }
            boolean coherent = rows.stream().anyMatch(r -> Boolean.TRUE.equals(r.get("coherent")));
            coherentDays += coherent ? 1 : 0;
            Map<String, Object> day = new LinkedHashMap<>();
            day.put("date", dl.getLookDate());
            day.put("dailyLook", service.view(dl));
            day.put("moments", rows);
            day.put("coherent", coherent);
            days.add(day);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("year", year);
        out.put("month", month);
        out.put("days", days);
        out.put("summary", Map.of("days", days.size(), "coherentDays", coherentDays));
        return out;
    }
}
