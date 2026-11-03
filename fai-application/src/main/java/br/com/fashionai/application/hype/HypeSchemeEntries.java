package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeSnapshotService.Entry;
import br.com.fashionai.application.hype.HypeSnapshotService.Lifetime;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.hype.HypePieceEntries.limitedEdition;
import static br.com.fashionai.application.hype.HypePieceEntries.surprise;
import static br.com.fashionai.application.hype.HypeSnapshotService.ageDays;
import static br.com.fashionai.application.hype.HypeSnapshotService.csvOf;
import static br.com.fashionai.application.hype.HypeSnapshotService.place;
import static br.com.fashionai.application.hype.HypeSnapshotService.trim;

/**
 * HypeScore v2 — entradas dos looks para o job: elegibilidade pública, influência (remixes e looks derivados), raridade
 * pelas peças, originalidade das combinações e os recortes de categoria/subcategoria das peças que compõem o look.
 */
final class HypeSchemeEntries {
    private final HypeScoreConfig config;

    HypeSchemeEntries(HypeScoreConfig config) {
        this.config = config;
    }

    static boolean publicScheme(Scheme s) {
        return s.getVisibility() == Visibility.PUBLIC && s.getStatus() == SchemeStatus.PUBLISHED
                && s.getUser().getProfileVisibility() == Visibility.PUBLIC && !s.getUser().isTestAccount();
    }

    List<Entry> schemeEntries(List<Scheme> all, Map<UUID, List<SchemeItem>> itemsBy, Map<UUID, HypeSignalSeries> series, Map<UUID, Lifetime> lifetimes,
                              Map<UUID, Entry> pieceById, Instant now) {
        // influência: remixes diretos + looks derivados dos remixes (segunda geração)
        Map<UUID, List<UUID>> children = new HashMap<>();
        all.forEach(s -> {
            if (s.getOriginalScheme() != null) {
                children.computeIfAbsent(s.getOriginalScheme().getId(), k -> new ArrayList<>()).add(s.getId());
            }
        });
        Map<String, Integer> freq = new HashMap<>();
        Map<UUID, List<String>> keysBy = new HashMap<>();
        for (Scheme s : all) {
            List<String> keys = lookKeys(s, itemsBy.getOrDefault(s.getId(), List.of()));
            keysBy.put(s.getId(), keys);
            new HashSet<>(keys).forEach(k -> freq.merge(k, 1, Integer::sum));
        }
        List<Entry> out = new ArrayList<>();
        for (Scheme s : all) {
            HypeSignalSeries ss = series.getOrDefault(s.getId(), HypeSignalSeries.empty(config.horizonDays()));
            List<SchemeItem> items = itemsBy.getOrDefault(s.getId(), List.of());
            // raridade do look = exclusividade média das peças (presença dos modelos), nunca "poucas interações"
            List<Double> presences = items.stream().map(si -> pieceById.get(si.getWardrobeItem().getId())).filter(e -> e != null && e.inputs().cohortPresence() != null)
                    .map(e -> e.inputs().cohortPresence()).toList();
            Double presence = presences.isEmpty() ? null : presences.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            boolean limited = items.stream().anyMatch(si -> limitedEdition(si.getWardrobeItem().getTags()));
            long direct = s.getRemixCount();
            long second = children.getOrDefault(s.getId(), List.of()).stream().mapToLong(c -> children.getOrDefault(c, List.of()).size()).sum();
            double influence = direct + 0.5 * second;
            Lifetime lifetime = lifetimes.getOrDefault(s.getId(), Lifetime.NONE);
            HypeInputs in = new HypeInputs(HypeEntityType.SCHEME, ss.activity(), ss.interactions(), ss.views(), ss.windows(), lifetime.interactions(), lifetime.views(),
                    ss.totalEvents() + lifetime.events(), ageDays(s.getPublishedAt() != null ? s.getPublishedAt() : s.getCreatedAt(), now), presence, null,
                    surprise(keysBy.get(s.getId()), freq, all.size()), influence, limited);
            String[] place = place(s.getUser());
            // o look entra nos recortes de categoria/subcategoria das peças que o compõem
            out.add(new Entry(s.getId(), s.getUser().getId(), in, publicScheme(s), null, trim(s.getStyle()), trim(s.getOccasion()), place[0], place[1],
                    csvOf(items.stream().map(si -> si.getWardrobeItem().getCategory()), 255),
                    csvOf(items.stream().map(si -> si.getWardrobeItem().getSubcategory()), 1000)));
        }
        return out;
    }

    /** Combinações do look: pares de peças (categoria+cor) e estilo×ocasião — "combinações incomuns" viram originalidade. */
    static List<String> lookKeys(Scheme s, List<SchemeItem> items) {
        List<String> parts = items.stream().map(si -> si.getWardrobeItem().getCategory() + ":" + si.getWardrobeItem().getColor()).sorted().toList();
        List<String> keys = new ArrayList<>();
        for (int i = 0; i < parts.size(); i++) {
            for (int j = i + 1; j < parts.size(); j++) {
                keys.add("pair:" + parts.get(i) + "+" + parts.get(j));
            }
        }
        for (String st : Json.csv(s.getStyle())) {
            for (String oc : Json.csv(s.getOccasion())) {
                keys.add("so:" + st + "|" + oc);
            }
        }
        return keys;
    }
}
