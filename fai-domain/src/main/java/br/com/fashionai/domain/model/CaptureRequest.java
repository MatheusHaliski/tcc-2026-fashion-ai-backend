package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.CaptureNeed;
import br.com.fashionai.domain.model.enums.CapturePurpose;
import br.com.fashionai.domain.model.enums.CaptureRequestStatus;
import br.com.fashionai.domain.model.enums.CaptureView;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Pedido de foto complementar com propósito explícito; Pular nunca bloqueia o cadastro. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "capture_requests")
public class CaptureRequest extends VersionedAuditableEntity {
    @Column(name = "session_id", nullable = false, length = 36)
    private UUID sessionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "view_type", nullable = false, length = 30)
    private CaptureView viewType;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false, length = 40)
    private CapturePurpose purpose;

    @Enumerated(EnumType.STRING)
    @Column(name = "need", nullable = false, length = 30)
    private CaptureNeed need;

    @Column(name = "reason_code", nullable = false, length = 80)
    private String reasonCode;

    @Column(name = "dominant_signal", length = 30)
    private String dominantSignal;

    @Column(name = "expected_gain", nullable = false, precision = 6, scale = 4)
    private BigDecimal expectedGain;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CaptureRequestStatus status;

    @Column(name = "fulfilled_image_id", length = 36)
    private UUID fulfilledImageId;

    @Column(name = "confidence_before", precision = 5, scale = 4)
    private BigDecimal confidenceBefore;

    @Column(name = "confidence_after", precision = 5, scale = 4)
    private BigDecimal confidenceAfter;

    @Column(name = "resolved_at")
    private Instant resolvedAt;
}
