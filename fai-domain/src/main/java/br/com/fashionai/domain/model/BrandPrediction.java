package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.IdentificationLevel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Saída do ensemble por nível (marca, linha, modelo…), com evidências e alternativas. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "brand_predictions")
public class BrandPrediction extends VersionedAuditableEntity {
    @Column(name = "session_id", nullable = false, length = 36)
    private UUID sessionId;

    @Column(name = "piece_id", length = 36)
    private UUID pieceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "pred_level", nullable = false, length = 20)
    private IdentificationLevel level;

    @Column(name = "pred_value", length = 160)
    private String value;

    @Column(name = "confidence", nullable = false, precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "evidence_json", columnDefinition = "json")
    private String evidenceJson;

    @Column(name = "alternatives_json", columnDefinition = "json")
    private String alternativesJson;

    @Column(name = "resolver_version", nullable = false, length = 120)
    private String resolverVersion;
}
