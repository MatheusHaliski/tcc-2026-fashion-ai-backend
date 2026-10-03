package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.CaptureSessionStatus;
import br.com.fashionai.domain.model.enums.CaptureView;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Sessão progressiva de captura: uma foto obrigatória e complementares só quando aumentam a confiança. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "capture_sessions")
public class CaptureSession extends VersionedAuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "draft_job_id", length = 36)
    private UUID draftJobId;

    @Column(name = "category", length = 80)
    private String category;

    @Column(name = "subcategory", length = 120)
    private String subcategory;

    @Column(name = "profile_id", nullable = false, length = 40)
    private String profileId;

    @Enumerated(EnumType.STRING)
    @Column(name = "primary_view", nullable = false, length = 30)
    private CaptureView primaryView;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private CaptureSessionStatus status;

    @Column(name = "identify_model", nullable = false)
    private boolean identifyModel;

    @Column(name = "complementary_count", nullable = false)
    private int complementaryCount;

    @Column(name = "consecutive_skips", nullable = false)
    private int consecutiveSkips;

    @Column(name = "identification_json", columnDefinition = "json")
    private String identificationJson;

    @Column(name = "decision_json", columnDefinition = "json")
    private String decisionJson;

    @Column(name = "quality_json", columnDefinition = "json")
    private String qualityJson;

    @Column(name = "piece_id", length = 36)
    private UUID pieceId;

    @Column(name = "completed_at")
    private Instant completedAt;
}
