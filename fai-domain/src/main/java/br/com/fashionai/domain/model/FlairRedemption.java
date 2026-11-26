package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** FLAIR — cupom emitido quando o deck completa a combinação da loja (um por pessoa e combinação). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_redemptions")
public class FlairRedemption extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "combination_id", nullable = false)
    private FlairCombination combination;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scheme_id")
    private Scheme scheme;

    @Column(nullable = false, length = 24)
    private String code;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "deck_power")
    private Integer deckPower;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    /** Exercício 14 — canal da oferta copiado na emissão: mudar o canal da oferta depois não muda este cupom. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "canal_cupom_id")
    private CanalCupom canalCupom;

    /** Código do canal na hora da emissão (LOJA_FISICA, ECOMMERCE, AMBOS); nulo = cupom antigo, canal não informado. */
    @Column(name = "canal_codigo_snapshot", length = 40)
    private String canalCodigoSnapshot;

    /** Exercício 15 — compra mínima e moeda contratadas na hora da emissão; nulos = sem registro (cupom antigo ou oferta sem mínimo). */
    @Column(name = "min_purchase_snapshot", precision = 10, scale = 2)
    private java.math.BigDecimal minPurchaseSnapshot;

    @Column(name = "min_purchase_currency_snapshot", length = 3, columnDefinition = "char(3)")
    private String minPurchaseCurrencySnapshot;

    /** Circuito Aura (fase 1) — faixa de Hype do card na hora da emissão; nulo = oferta sem exigência (ou cupom antigo). */
    @Column(name = "hype_level_snapshot", length = 20)
    private String hypeLevelSnapshot;
}
