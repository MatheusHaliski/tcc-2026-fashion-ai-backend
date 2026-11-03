package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.FlairChallengeRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.service.FlairCollectionService.TIERS;

/**
 * Visões das cartas FLAIR do {@link FlairCollectionService}: a carta (frente, verso e, para a dona, o porquê do nível e
 * as tags; entregue num desafio, a memória dele) e a coleção agrupada por nível.
 */
final class FlairCardViews {
    private final FlairChallengeRepository challengeRepo;

    FlairCardViews(FlairChallengeRepository challengeRepo) {
        this.challengeRepo = challengeRepo;
    }

    Map<String, Object> collection(List<FlairCardInstance> list, boolean mine) {
        Map<String, Long> counts = new LinkedHashMap<>();
        TIERS.forEach(t -> counts.put(t, list.stream().filter(c -> t.equals(c.getTier())).count()));
        List<Map<String, Object>> views = new ArrayList<>();
        list.stream().sorted(Comparator.comparingInt((FlairCardInstance c) -> TIERS.indexOf(c.getTier())).thenComparing(FlairCardInstance::getOvr, Comparator.reverseOrder()))
                .forEach(c -> views.add(view(c, mine)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("season", FlairService.season());
        out.put("counts", counts);
        out.put("total", list.size());
        out.put("cards", views);
        return out;
    }

    Map<String, Object> view(FlairCardInstance c, boolean mine) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("originType", c.getOriginType());
        m.put("originId", c.getOriginId());
        m.put("season", c.getSeason());
        m.put("tier", c.getTier());
        m.put("ovr", c.getOvr());
        m.put("rare", c.isRare());
        m.put("position", c.getPosition());
        m.put("name", c.getName());
        m.put("brandName", c.getBrandName());
        m.put("imageUrl", c.getImageUrl());
        m.put("category", c.getCategory());
        m.put("subcategory", c.getSubcategory());
        m.put("hype", c.getHypeJson() == null ? null : Json.map(c.getHypeJson()));
        Map<String, Object> back = c.getStatsJson() == null ? Map.of() : Json.map(c.getStatsJson());
        m.put("stats", back.get("stats"));
        m.put("rarity", back.get("rarity"));
        m.put("ability", back.get("ability"));
        m.put("priceVerified", c.isPriceVerified());
        m.put("state", c.getState());
        m.put("tradeable", c.isTradeable());
        m.put("acquiredVia", c.getAcquiredVia());
        m.put("createdAt", c.getCreatedAt());
        if (mine) {
            m.put("basis", c.getBasisJson() == null ? null : Json.map(c.getBasisJson()));
            m.put("tags", c.getTagsJson() == null ? null : Json.map(c.getTagsJson()));
        }
        // D7: entregue num Desafio de Montagem, a carta fica como memória — "Entregue em ‹desafio›"
        m.put("lockedIn", c.getLockedChallengeId() == null ? null : challengeRepo.findById(c.getLockedChallengeId())
                .map(x -> Map.<String, Object>of("id", x.getId(), "slug", x.getSlug(),
                        "name", br.com.fashionai.application.moments.MomentViews.localized(x.getName(), x.getNamesJson())))
                .orElse(null));
        return m;
    }
}
