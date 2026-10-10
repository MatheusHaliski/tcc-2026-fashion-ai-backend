package br.com.fashionai.application.hype;

import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.util.List;
import java.util.Map;

/**
 * HypeScore v2 — resultado do cálculo de uma entidade. {@code score} e {@code level} são nulos quando
 * {@code status == INSUFFICIENT_DATA}; dimensões ausentes ficam fora do mapa (nunca 0 por falta de dado).
 *
 * @param signals números de apoio exibidos na análise completa (crescimento %, janelas, taxa de engajamento…)
 */
public record HypeResult(HypeStatus status, Double score, HypeLevel level, Map<Dimension, Double> dimensions, HypeMomentum momentum,
                         List<HypeReason> reasons, Map<String, Object> signals) {

    /**
     * Motivo legível do score: um código estável (o frontend traduz: hype.reason.&lt;CODE&gt;), o tom e um número opcional
     * (ex.: SAVES_GROWTH, +43). Explicação humana sem afirmação absoluta de qualidade.
     *
     * @param tone POSITIVE, NEGATIVE ou NEUTRAL
     */
    public record HypeReason(String code, String tone, String dimension, Double value) {
    }
}
