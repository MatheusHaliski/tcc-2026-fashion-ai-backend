package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** HypeScore v2 no closet (RF6): o score de cada peça visível para quem vê e a faixa mínima do filtro por Hype. */
final class ClosetHype {
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    ClosetHype(HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
    }

    /**
     * Score v2 de cada peça (nulo = sem Hype: dados insuficientes ou ainda não calculado — sempre por último).
     * Privacidade (HYPE_AUDITORIA_ABAS §3.1, P2-11): o dono vê o Hype pessoal de todas as peças; para terceiros (perfil
     * de outra pessoa, visitante sem conta) só entra o score {@code publicEligible} — o resto conta como "sem Hype"
     * ("—" no card, por último na ordem, fora do filtro por faixa), mesmo que a peça seja visível para quem segue.
     */
    Map<UUID, HypeScoreCurrent> scores(List<WardrobeItem> list, boolean self) {
        if (hypeScores == null || hypeConfig == null || list.isEmpty()) {
            return Map.of();
        }
        return hypeScores.findByEntityTypeAndEntityIdInAndAlgorithmVersion(br.com.fashionai.domain.model.enums.HypeEntityType.PIECE,
                        list.stream().map(WardrobeItem::getId).toList(), hypeConfig.algorithmVersion()).stream()
                .filter(h -> self || h.isPublicEligible())
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, h -> h, (a, b) -> a));
    }

    /** Faixa mínima de Hype → score mínimo (limiares centralizados no HypeScoreConfig). */
    int minimum(String level) {
        int[] t = hypeConfig.levelThresholds();
        return switch (level.toUpperCase(Locale.ROOT)) {
            case "NICHE" -> t[0];
            case "RELEVANT" -> t[1];
            case "HOT" -> t[2];
            case "TRENDING" -> t[3];
            case "VIRAL" -> t[4];
            default -> 0;
        };
    }
}
