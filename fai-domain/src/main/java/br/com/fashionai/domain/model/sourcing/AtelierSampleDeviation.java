package br.com.fashionai.domain.model.sourcing;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Desvio da amostra em relação à ficha congelada: aceito com justificativa ou devolvido. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "atelier_sample_deviations")
public class AtelierSampleDeviation extends AuditableEntity {
    @Column(name = "production_request_id", nullable = false, length = 36)
    private UUID productionRequestId;

    @Column(name = "measurement_point", nullable = false, length = 80)
    private String measurementPoint;

    @Column(nullable = false, length = 120)
    private String expected;

    @Column(nullable = false, length = 120)
    private String measured;

    @Column(name = "recorded_by", nullable = false, length = 36)
    private UUID recordedBy;

    /** PENDING, ACCEPTED, RETURNED. */
    @Column(nullable = false, length = 10)
    private String decision = "PENDING";

    @Column(length = 1000)
    private String justification;

    @Column(name = "decided_by", length = 36)
    private UUID decidedBy;

    @Column(name = "decided_at")
    private Instant decidedAt;
}
