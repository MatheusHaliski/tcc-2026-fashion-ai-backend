package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * HU19 — modelo de preferências aprendidas a partir do feedback do Look do Dia (autopiloto-architecture.md,
 * PreferenceLearningService): "adorei" aumenta o peso do estilo, da ocasião, das cores e das peças do look;
 * "não usei"/"não gostei" reduzem. Recalculado a partir do histórico datado (fonte de verdade = daily_looks),
 * normalizado para [-1, 1] para evitar drift ilimitado.
 */
@Component
public class PreferenceModel {
    static final Map<DailyLookFeedback, Double> WEIGHT = Map.of(DailyLookFeedback.ADOREI, 1.0, DailyLookFeedback.NAO_USEI, -0.3,
            DailyLookFeedback.NAO_GOSTEI, -0.8);

    public record Model(Map<String, Double> styles, Map<String, Double> occasions, Map<String, Double> colors, Map<UUID, Double> pieces,
                        Map<String, Double> combinations, int signals) {
        public double pieceScore(Collection<WardrobeItem> look) {
            if (signals == 0 || look.isEmpty()) {
                return 0.5;
            }
            double s = 0;
            for (WardrobeItem w : look) {
                s += pieces.getOrDefault(w.getId(), 0.0) * 0.4;
                s += colors.getOrDefault(w.getColor(), 0.0) * 0.2;
                for (String st : Json.csv(w.getStyleTags())) {
                    s += styles.getOrDefault(st, 0.0) * 0.2;
                }
                for (String oc : Json.csv(w.getOccasionTags())) {
                    s += occasions.getOrDefault(oc, 0.0) * 0.2;
                }
            }
            double avg = s / look.size();
            String key = SchemeService.combinationKey(look.stream().map(WardrobeItem::getId).toList());
            avg += combinations.getOrDefault(key, 0.0) * 0.5;
            return Math.max(0, Math.min(1, 0.5 + avg / 2));
        }
    }

    private final DailyLookRepository dailyLooks;
    private final SchemeItemRepository schemeItems;

    public PreferenceModel(DailyLookRepository dailyLooks, SchemeItemRepository schemeItems) {
        this.dailyLooks = dailyLooks;
        this.schemeItems = schemeItems;
    }

    public Model of(UUID userId) {
        Map<String, Double> styles = new HashMap<>(), occasions = new HashMap<>(), colors = new HashMap<>(), combos = new HashMap<>();
        Map<UUID, Double> pieces = new HashMap<>();
        int signals = 0;
        for (DailyLook dl : dailyLooks.findTop60ByUserIdOrderByLookDateDesc(userId)) {
            if (dl.getFeedback() == null) {
                continue;
            }
            double w = WEIGHT.getOrDefault(dl.getFeedback(), 0.0);
            signals++;
            Json.csv(dl.getScheme().getStyle()).forEach(s -> styles.merge(s, w, Double::sum));
            Json.csv(dl.getScheme().getOccasion()).forEach(o -> occasions.merge(o, w, Double::sum));
            List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(dl.getScheme().getId());
            for (SchemeItem si : items) {
                WardrobeItem p = si.getWardrobeItem();
                pieces.merge(p.getId(), w, Double::sum);
                if (p.getColor() != null) {
                    colors.merge(p.getColor(), w, Double::sum);
                }
            }
            combos.merge(SchemeService.combinationKey(items.stream().map(si -> si.getWardrobeItem().getId()).toList()), w, Double::sum);
        }
        return new Model(normalize(styles), normalize(occasions), normalize(colors), normalizeIds(pieces), normalize(combos), signals);
    }

    static Map<String, Double> normalize(Map<String, Double> m) {
        double max = m.values().stream().mapToDouble(Math::abs).max().orElse(1);
        Map<String, Double> out = new HashMap<>();
        m.forEach((k, v) -> out.put(k, max == 0 ? 0 : v / max));
        return out;
    }

    static Map<UUID, Double> normalizeIds(Map<UUID, Double> m) {
        double max = m.values().stream().mapToDouble(Math::abs).max().orElse(1);
        Map<UUID, Double> out = new HashMap<>();
        m.forEach((k, v) -> out.put(k, max == 0 ? 0 : v / max));
        return out;
    }
}
