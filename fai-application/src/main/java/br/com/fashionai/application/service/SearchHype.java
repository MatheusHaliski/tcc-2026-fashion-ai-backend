package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * HypeScore v2 em contexto de terceiros (RF53), regras puras compartilhadas pela busca, pela vitrine 3D e pelo
 * Explorador: só o Hype {@code publicEligible} e disponível ordena, filtra ou agrega; o dono vê o pessoal; "sem dado"
 * nunca vira 0. Também lê o estado gravado de uma lista numa consulta e monta o resumo dos cards.
 */
final class SearchHype {
    private SearchHype() {
    }

    /**
     * Linha de Hype que pode ORDENAR, FILTRAR ou AGREGAR em contexto de terceiros: só {@code publicEligible} e AVAILABLE
     * com score. Item privado ou só para seguidores tem Hype pessoal (do dono), que nunca entra em vitrine pública.
     */
    static HypeScoreCurrent publicRow(HypeScoreCurrent c) {
        return c != null && c.isPublicEligible() && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null ? c : null;
    }

    /** Score v2 público (nulo = sem Hype público: fica neutro ou por último, nunca 0). */
    static Double publicScore(HypeScoreCurrent c) {
        HypeScoreCurrent p = publicRow(c);
        return p == null ? null : p.getScore().doubleValue();
    }

    /** Como {@link #publicScore}, mas o próprio dono usa o Hype pessoal (vitrine do próprio perfil). */
    static Double scoreFor(HypeScoreCurrent c, boolean self) {
        if (self && c != null && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null) {
            return c.getScore().doubleValue();
        }
        return publicScore(c);
    }

    /** Dimensão TREND (crescimento recente) com a mesma regra de visibilidade: tendência ≠ popularidade. */
    static Double trendFor(HypeScoreCurrent c, boolean self) {
        if (scoreFor(c, self) == null || c.getDimensions() == null || c.getDimensions().getTrend() == null) {
            return null;
        }
        return c.getDimensions().getTrend().doubleValue();
    }

    /** Variação em pontos contra a semana anterior (ordem "Em crescimento"), com a mesma regra de visibilidade. */
    static Double growthFor(HypeScoreCurrent c, boolean self) {
        return scoreFor(c, self) == null || c.getDeltaPoints() == null ? null : c.getDeltaPoints().doubleValue();
    }

    /** Momento de alta (RISING ou EMERGING) no Hype público. */
    static boolean risingFor(HypeScoreCurrent c, boolean self) {
        return scoreFor(c, self) != null && (c.getMomentum() == HypeMomentum.RISING || c.getMomentum() == HypeMomentum.EMERGING);
    }

    /** Estado v2 de vários itens numa consulta (uma por página/lista). Sem repositório (testes antigos) = vazio. */
    static Map<UUID, HypeScoreCurrent> hypeRows(HypeScoreCurrentRepository repo, HypeScoreConfig cfg, HypeEntityType type, Collection<UUID> ids) {
        if (repo == null || cfg == null || ids == null || ids.isEmpty()) {
            return new HashMap<>();
        }
        List<UUID> distinct = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (distinct.isEmpty()) {
            return new HashMap<>();
        }
        return repo.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, distinct, cfg.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a, HashMap::new));
    }

    /** Faixa mínima pedida no filtro (nulo = sem filtro). Valor desconhecido = 400, com as faixas válidas. */
    static HypeLevel parseLevel(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return HypeLevel.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("NIVEL_INVALIDO", "hypeLevel: " + Arrays.toString(HypeLevel.values()));
        }
    }

    /** Score mínimo da faixa (limiares do HypeScoreConfig; LOW_SIGNAL = qualquer score público). */
    static double levelMinimum(HypeScoreConfig cfg, HypeLevel level) {
        int[] t = cfg == null ? HypeScoreConfig.defaults().levelThresholds() : cfg.levelThresholds();
        return level == null || level.ordinal() == 0 ? 0 : t[Math.min(t.length, level.ordinal()) - 1];
    }

    /**
     * O item passa no filtro de faixa mínima? Só com Hype PÚBLICO disponível e com o mesmo arredondamento da faixa
     * exibida (59,5 aparece como 60 = Em alta). Sem Hype público nunca passa (não é "0", é "sem dado").
     */
    static boolean meetsLevel(HypeScoreCurrent c, HypeLevel min, HypeScoreConfig cfg) {
        if (min == null) {
            return true;
        }
        Double score = publicScore(c);
        return score != null && score >= levelMinimum(cfg, min) - 0.5;
    }

    /**
     * Resumo no formato do HypeSummary dos cards ({@code /api/hype/summaries}) para quem vê: público elegível para todos;
     * Hype pessoal só para o dono ({@code self}); para os demais, item sem Hype público vira NOT_CALCULATED ("—" na tela).
     * Sem dimensões (o verso e a análise completa buscam o detalhe); "sem dados" nunca vira 0.
     */
    static Map<String, Object> hypeSummary(HypeScoreCurrent c, boolean self, HypeScoreConfig cfg) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (c == null || !(c.isPublicEligible() || self)) {
            m.put("status", "NOT_CALCULATED");
            return m;
        }
        boolean available = c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null;
        m.put("status", available ? HypeStatus.AVAILABLE.name() : HypeStatus.INSUFFICIENT_DATA.name());
        int staleHours = cfg == null ? 24 : cfg.staleAfterHours();
        m.put("stale", c.getCalculatedAt() != null && c.getCalculatedAt().isBefore(Instant.now().minus(staleHours, ChronoUnit.HOURS)));
        m.put("score", available ? round1(c.getScore().doubleValue()) : null);
        m.put("level", available && c.getLevel() != null ? c.getLevel().name() : null);
        m.put("direction", available ? c.getDirection() : null);
        m.put("deltaPoints", available && c.getDeltaPoints() != null ? round1(c.getDeltaPoints().doubleValue()) : null);
        m.put("deltaPercent", available && c.getDeltaPercent() != null ? round1(c.getDeltaPercent().doubleValue()) : null);
        m.put("momentum", available && c.getMomentum() != null ? c.getMomentum().name() : null);
        m.put("calculatedAt", c.getCalculatedAt() == null ? null : c.getCalculatedAt().toString());
        m.put("algorithmVersion", c.getAlgorithmVersion());
        m.put("publicEligible", c.isPublicEligible());
        return m;
    }

    static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
