package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.AiCallResult;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * RF24.CA16 — ai_inference_log: usuário, função, provedor, modelo, latência, custo estimado e resultado.
 * inputSummaryJson descreve QUAIS dados alimentaram a inferência (CA12 "por quê?") — nunca foto,
 * senha, token ou conteúdo de campo cifrado.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "ai_inference_log")
public class AiInferenceLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, length = 36)
    private UUID id;

    @Column(name = "user_id", length = 36)
    private UUID userId;

    @Column(nullable = false, length = 50)
    private String capability;

    @Column(name = "host_rf", length = 10)
    private String hostRf;

    @Column(nullable = false, length = 60)
    private String provider;

    @Column(length = 120)
    private String model;

    @Column(name = "latency_ms", nullable = false)
    private long latencyMs;

    @Column(name = "estimated_cost_usd", precision = 10, scale = 6)
    private BigDecimal estimatedCostUsd;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AiCallResult result;

    @Column(name = "fallback_used", nullable = false)
    private boolean fallbackUsed;

    @Column(name = "input_summary_json", columnDefinition = "json")
    private String inputSummaryJson;

    @Column(name = "output_summary", length = 1024)
    private String outputSummary;

    @Column(name = "consent_state", length = 40)
    private String consentState;

    @Column(name = "correlation_id", nullable = false, length = 120)
    private String correlationId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
