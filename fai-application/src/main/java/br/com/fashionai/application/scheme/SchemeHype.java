package br.com.fashionai.application.scheme;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;

public final class SchemeHype {
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    public SchemeHype(HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
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

    HypeLevel levelOf(HypeScoreCurrent h) {
        return h.getLevel() != null || hypeConfig == null ? h.getLevel() : hypeConfig.level(h.getScore().doubleValue());
    }

    /**
     * RF53 (P2-15) — rótulo do Hype no PNG do card: HypeScore v2 do look + faixa em texto ("HypeScore 72 · Em alta").
     * Sem dados (insuficiente ou não calculado) o rótulo é omitido, nunca "0". Para terceiros só aparece o Hype
     * público ({@code publicEligible}); o dono vê o próprio Hype pessoal (look privado ou só para seguidores).
     */
    public String cardHypeLabel(HypeScoreCurrent h, boolean owner) {
        return SchemeCardAssembler.hypeLabel(h == null ? null : h.getScore(), h == null || h.getScore() == null ? null : levelOf(h),
                h != null && (owner || h.isPublicEligible()));
    }
}
