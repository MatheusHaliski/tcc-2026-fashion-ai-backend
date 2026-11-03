package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/** HypeScore v2 da vitrine 3D: o estado gravado de uma lista numa consulta (GET nunca recalcula nem emite sinal). */
final class ShowcaseHype {
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    ShowcaseHype(HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
    }

    /** Estado v2 de uma lista numa consulta (sem repositório = vazio: tudo neutro, nada vira 0). */
    Map<UUID, HypeScoreCurrent> of(HypeEntityType type, Collection<UUID> ids) {
        return SearchHype.hypeRows(hypeScores, hypeConfig, type, ids);
    }
}
