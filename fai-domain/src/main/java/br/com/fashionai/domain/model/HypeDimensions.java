package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * HypeScore v2 — as dimensões normalizadas (0–100) de um cálculo. Nulo = dimensão sem dados para a entidade (entra fora
 * da média ponderada, nunca como 0). Compartilhada pelo estado atual ({@link HypeScoreCurrent}) e pelo histórico
 * ({@link HypeScoreSnapshot}).
 */
@Getter
@Setter
@NoArgsConstructor
@Embeddable
public class HypeDimensions {
    @Column(name = "popularity_score", precision = 6, scale = 2)
    private BigDecimal popularity;

    @Column(name = "engagement_score", precision = 6, scale = 2)
    private BigDecimal engagement;

    @Column(name = "trend_score", precision = 6, scale = 2)
    private BigDecimal trend;

    @Column(name = "trend_velocity_score", precision = 6, scale = 2)
    private BigDecimal trendVelocity;

    @Column(name = "novelty_score", precision = 6, scale = 2)
    private BigDecimal novelty;

    @Column(name = "longevity_score", precision = 6, scale = 2)
    private BigDecimal longevity;

    @Column(name = "rarity_score", precision = 6, scale = 2)
    private BigDecimal rarity;

    @Column(name = "originality_score", precision = 6, scale = 2)
    private BigDecimal originality;

    @Column(name = "influence_score", precision = 6, scale = 2)
    private BigDecimal influence;
}
