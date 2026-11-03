package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeSnapshotService.Entry;
import br.com.fashionai.application.hype.HypeSnapshotService.Lifetime;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.Visibility;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.hype.HypeSnapshotService.ageDays;
import static br.com.fashionai.application.hype.HypeSnapshotService.place;
import static br.com.fashionai.application.hype.HypeSnapshotService.trim;

/**
 * HypeScore v2 — entradas das peças para o job: elegibilidade pública, "modelo" da peça (raridade e tendência das
 * semelhantes), edição limitada e originalidade (autoinformação dos atributos).
 */
final class HypePieceEntries {
    private final HypeScoreConfig config;

    HypePieceEntries(HypeScoreConfig config) {
        this.config = config;
    }

    static boolean publicPiece(WardrobeItem w) {
        return w.getVisibility() == Visibility.PUBLIC && w.getUser().getProfileVisibility() == Visibility.PUBLIC
                && w.getModerationStatus() == ModerationStatus.APPROVED && !w.getUser().isTestAccount();
    }

    /** "Modelo" da peça para raridade e tendência das semelhantes: produto do catálogo ou categoria + subcategoria + marca. */
    static String cohortKey(WardrobeItem w) {
        if (w.getCatalogProductId() != null) {
            return "cat:" + w.getCatalogProductId();
        }
        return "k:" + w.getCategory() + "|" + w.getSubcategory() + "|" + (w.getBrandName() == null ? "" : w.getBrandName().trim().toLowerCase(Locale.ROOT));
    }

    static boolean limitedEdition(String tags) {
        if (tags == null) {
            return false;
        }
        String t = tags.toLowerCase(Locale.ROOT);
        return t.contains("limitad") || t.contains("limited") || t.contains("exclusiv");
    }

    List<Entry> pieceEntries(List<WardrobeItem> all, Map<UUID, HypeSignalSeries> series, Map<UUID, Lifetime> lifetimes, Instant now) {
        int w = config.windowDays();
        // presença do modelo entre os donos (agregado não identificável)
        Map<String, Set<UUID>> owners = new HashMap<>();
        Set<UUID> allOwners = new HashSet<>();
        Map<String, double[]> cohortWindows = new HashMap<>();
        for (WardrobeItem p : all) {
            owners.computeIfAbsent(cohortKey(p), k -> new HashSet<>()).add(p.getUser().getId());
            allOwners.add(p.getUser().getId());
            HypeSignalSeries s = series.get(p.getId());
            if (s != null && publicPiece(p)) {   // tendência das semelhantes só com dados públicos
                double[] acc = cohortWindows.computeIfAbsent(cohortKey(p), k -> new double[2]);
                acc[0] += s.activityBetween(0, w);
                acc[1] += s.activityBetween(w, 2 * w);
            }
        }
        Map<String, Integer> freq = new HashMap<>();
        all.forEach(p -> attributeKeys(p).forEach(k -> freq.merge(k, 1, Integer::sum)));
        List<Entry> out = new ArrayList<>();
        for (WardrobeItem p : all) {
            HypeSignalSeries s = series.getOrDefault(p.getId(), HypeSignalSeries.empty(config.horizonDays()));
            boolean pub = publicPiece(p);
            String key = cohortKey(p);
            double presence = (double) owners.get(key).size() / Math.max(1, allOwners.size());
            double[] cw = cohortWindows.getOrDefault(key, new double[2]).clone();
            if (pub) {   // as semelhantes são as OUTRAS peças do modelo
                cw[0] -= s.activityBetween(0, w);
                cw[1] -= s.activityBetween(w, 2 * w);
            }
            Double cohortGrowth = cw[0] + cw[1] >= 3 ? ((cw[0] + config.growthSmoothing()) / (cw[1] + config.growthSmoothing()) - 1) * 100 : null;
            Lifetime lifetime = lifetimes.getOrDefault(p.getId(), Lifetime.NONE);
            HypeInputs in = new HypeInputs(HypeEntityType.PIECE, s.activity(), s.interactions(), s.views(), s.windows(), lifetime.interactions(), lifetime.views(),
                    s.totalEvents() + lifetime.events(), ageDays(p.getCreatedAt(), now), presence, cohortGrowth, surprise(attributeKeys(p), freq, all.size()), null,
                    limitedEdition(p.getTags()));
            String[] place = place(p.getUser());
            out.add(new Entry(p.getId(), p.getUser().getId(), in, pub, p.getCategory(), trim(p.getStyleTags()), trim(p.getOccasionTags()),
                    place[0], place[1], p.getCategory(), p.getSubcategory()));
        }
        return out;
    }

    static List<String> attributeKeys(WardrobeItem p) {
        List<String> keys = new ArrayList<>();
        if (p.getCategory() != null && p.getColor() != null) {
            keys.add("cc:" + p.getCategory() + "|" + p.getColor());
        }
        if (p.getCategory() != null && p.getMaterial() != null) {
            keys.add("cm:" + p.getCategory() + "|" + p.getMaterial());
        }
        Json.csv(p.getStyleTags()).forEach(st -> keys.add("st:" + p.getCategory() + "|" + st));
        return keys;
    }

    /** Autoinformação média (bits) dos atributos: combinação comum ≈ 0, combinação rara = muitos bits. */
    static Double surprise(Collection<String> keys, Map<String, Integer> freq, int population) {
        if (keys.isEmpty() || population <= 0) {
            return null;
        }
        return keys.stream().mapToDouble(k -> -Math.log((double) Math.max(1, freq.getOrDefault(k, 1)) / population) / Math.log(2)).average().orElse(0);
    }
}
