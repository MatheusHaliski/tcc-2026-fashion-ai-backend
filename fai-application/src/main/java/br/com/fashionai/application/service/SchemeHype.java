package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF53 — HypeScore v2 dos looks e das peças lido direto do estado gravado pelo job (GET nunca recalcula): consulta em
 * lote, faixa do estado e o rótulo do Hype no PNG do card.
 */
final class SchemeHype {
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    SchemeHype(HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
    }

    /** Estado atual do HypeScore v2 (versão ativa) de várias entidades, numa consulta. */
    Map<UUID, HypeScoreCurrent> currentHype(HypeEntityType type, List<UUID> ids) {
        if (hypeScores == null || hypeConfig == null || ids == null || ids.isEmpty()) {
            return Map.of();
        }
        return hypeScores.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, ids, hypeConfig.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, h -> h, (a, b) -> a));
    }

    /** Faixa do estado gravado; sem ela (linha antiga), a mesma classificação do job a partir do score. */
    HypeLevel levelOf(HypeScoreCurrent h) {
        return h.getLevel() != null || hypeConfig == null ? h.getLevel() : hypeConfig.level(h.getScore().doubleValue());
    }

    /**
     * RF53 (P2-15) — rótulo do Hype no PNG do card: HypeScore v2 do look + faixa em texto ("HypeScore 72 · Em alta").
     * Sem dados (insuficiente ou não calculado) o rótulo é omitido, nunca "0". Para terceiros só aparece o Hype
     * público ({@code publicEligible}); o dono vê o próprio Hype pessoal (look privado ou só para seguidores).
     */
    String cardHypeLabel(HypeScoreCurrent h, boolean owner) {
        return cardHypeLabel(h == null ? null : h.getScore(), h == null || h.getScore() == null ? null : levelOf(h),
                h != null && (owner || h.isPublicEligible()));
    }

    static String cardHypeLabel(BigDecimal score, HypeLevel level, boolean visible) {
        if (!visible || score == null || level == null) {
            return null;
        }
        return Msg.t("schemeHype.card", score.setScale(0, java.math.RoundingMode.HALF_UP), Msg.t("schemeHype.level." + level.name()));
    }
}
