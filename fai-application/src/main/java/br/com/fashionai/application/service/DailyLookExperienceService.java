package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.DailyLookPurpose;
import br.com.fashionai.domain.repository.DailyLookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Look do Dia Vivido F2 — selo de experiência do look ("Usado em 3 entrevistas · 2 deram certo", §4.2) e o marco
 * "Semana vestida" (§4.3): Look do Dia de segunda a sexta com propósito de trabalho ou estudo vira conquista, uma vez.
 * Dados da própria pessoa, nunca promessa; propósito sensível não entra no selo.
 */
@Service
public class DailyLookExperienceService {
    public static final String WEEK_ACHIEVEMENT = "SEMANA_VESTIDA";
    static final Set<DailyLookPurpose> WEEK_PURPOSES = Set.of(DailyLookPurpose.TRABALHO_PRESENCIAL, DailyLookPurpose.HOME_OFFICE, DailyLookPurpose.ESTUDO,
            DailyLookPurpose.ENTREVISTA, DailyLookPurpose.APRESENTACAO, DailyLookPurpose.PRIMEIRO_DIA);

    private final DailyLookRepository dailyLooks;
    private final AchievementService achievements;

    public DailyLookExperienceService(DailyLookRepository dailyLooks, AchievementService achievements) {
        this.dailyLooks = dailyLooks;
        this.achievements = achievements;
    }

    /** GET /api/me/daily-looks/experience?schemeId — por propósito: quantas vezes o look foi usado e quantas deram certo. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> experience(CurrentUser user, UUID schemeId) {
        Map<DailyLookPurpose, int[]> acc = new EnumMap<>(DailyLookPurpose.class);
        for (DailyLook dl : dailyLooks.findBySchemeIdOrderByLookDate(schemeId)) {
            if (!dl.getUser().getId().equals(user.id()) || dl.getPurpose() == null || dl.getPurpose().sensitive()) {
                continue;
            }
            int[] a = acc.computeIfAbsent(dl.getPurpose(), k -> new int[2]);
            a[0]++;
            if (dl.getFeedback() == DailyLookFeedback.ADOREI) {
                a[1]++;
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        acc.entrySet().stream().sorted(Comparator.comparingInt((Map.Entry<DailyLookPurpose, int[]> e) -> e.getValue()[0]).reversed()).forEach(e -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("purpose", e.getKey().name());
            row.put("label", Msg.t("dailyLook.purpose." + e.getKey().name()));
            row.put("times", e.getValue()[0]);
            row.put("worked", e.getValue()[1]);
            out.add(row);
        });
        return out;
    }

    /** Depois de registrar um Look do Dia: se a semana (seg–sex) do dia está completa com propósito de trabalho/estudo, concede o marco. */
    public boolean weekCheck(UUID userId, LocalDate day) {
        LocalDate monday = day.with(DayOfWeek.MONDAY);
        List<DailyLook> week = dailyLooks.findByUserIdAndLookDateBetweenOrderByLookDate(userId, monday, monday.plusDays(4));
        long workdays = week.stream().filter(dl -> dl.getPurpose() != null && WEEK_PURPOSES.contains(dl.getPurpose()))
                .map(DailyLook::getLookDate).distinct().count();
        return workdays == 5 && achievements.grant(userId, WEEK_ACHIEVEMENT);
    }
}
