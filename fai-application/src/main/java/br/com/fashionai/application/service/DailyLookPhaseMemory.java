package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import org.springframework.stereotype.Service;

import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Look do Dia Vivido F3 — a Memória de uma fase ("30 dias · 22 looks · as 5 peças que mais te acompanharam", §4.4):
 * dias vividos, looks distintos, propósitos e as peças mais usadas. A versão pública leva só contagens e peças PUBLIC.
 */
@Service
public class DailyLookPhaseMemory {
    public static final int TOP_PIECES = 5;

    private final SchemeItemRepository schemeItems;

    public DailyLookPhaseMemory(SchemeItemRepository schemeItems) {
        this.schemeItems = schemeItems;
    }

    Map<String, Object> full(Moment m, List<DailyLook> days, Map<String, Object> phase) {
        Map<String, Object> out = summary(m, days, phase, false);
        out.put("days", days.stream().map(DailyLookPhaseMemory::dayRow).toList());
        return out;
    }

    Map<String, Object> publicSummary(Moment m, List<DailyLook> days, Map<String, Object> phase) {
        return summary(m, days, phase, true);
    }

    /** Resumo para a dona (lista "minhas fases"): mesmas contagens, todas as peças. */
    Map<String, Object> ownerSummary(Moment m, List<DailyLook> days, Map<String, Object> phase) {
        return summary(m, days, phase, false);
    }

    private Map<String, Object> summary(Moment m, List<DailyLook> days, Map<String, Object> phase, boolean onlyPublic) {
        Map<String, Object> out = new LinkedHashMap<>(phase);
        long total = ChronoUnit.DAYS.between(br.com.fashionai.application.moments.MomentTime.localStart(m), br.com.fashionai.application.moments.MomentTime.localEnd(m)) + 1;
        out.put("totalDays", total);
        out.put("daysWithLook", days.stream().map(DailyLook::getLookDate).distinct().count());
        out.put("looks", days.stream().map(dl -> dl.getScheme().getId()).distinct().count());
        Map<String, Integer> purposes = new LinkedHashMap<>();
        for (DailyLook dl : days) {
            if (dl.getPurpose() != null && !dl.getPurpose().sensitive()) {
                purposes.merge(Msg.t("dailyLook.purpose." + dl.getPurpose().name()), 1, Integer::sum);
            }
        }
        out.put("purposes", purposes);
        out.put("topPieces", topPieces(days, onlyPublic));
        return out;
    }

    private List<Map<String, Object>> topPieces(List<DailyLook> days, boolean onlyPublic) {
        Map<UUID, int[]> count = new HashMap<>();
        Map<UUID, WardrobeItem> pieces = new HashMap<>();
        for (DailyLook dl : days) {
            for (SchemeItem si : schemeItems.findBySchemeIdOrderBySortOrder(dl.getScheme().getId())) {
                WardrobeItem w = si.getWardrobeItem();
                if (w == null || (onlyPublic && w.getVisibility() != Visibility.PUBLIC)) {
                    continue;
                }
                pieces.put(w.getId(), w);
                count.computeIfAbsent(w.getId(), k -> new int[1])[0]++;
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        count.entrySet().stream().sorted(Comparator.comparingInt((Map.Entry<UUID, int[]> e) -> e.getValue()[0]).reversed()
                .thenComparing(e -> pieces.get(e.getKey()).getName())).limit(TOP_PIECES).forEach(e -> {
            WardrobeItem w = pieces.get(e.getKey());
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("id", w.getId());
            p.put("name", w.getName());
            p.put("imageUrl", w.getThumbnailUrl() == null ? w.getImageUrl() : w.getThumbnailUrl());
            p.put("times", e.getValue()[0]);
            out.add(p);
        });
        return out;
    }

    private static Map<String, Object> dayRow(DailyLook dl) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("date", dl.getLookDate());
        r.put("schemeId", dl.getScheme().getId());
        r.put("title", dl.getScheme().getTitle());
        r.put("coverImageUrl", dl.getScheme().getCoverImageUrl());
        r.put("purpose", dl.getPurpose() == null ? null : dl.getPurpose().name());
        r.put("purposeLabel", dl.getPurpose() == null ? null : Msg.t("dailyLook.purpose." + dl.getPurpose().name()));
        r.put("feedback", dl.getFeedback() == null ? null : dl.getFeedback().name());
        return r;
    }
}
