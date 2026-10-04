package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.TrainingCandidateStatus;
import br.com.fashionai.domain.model.enums.VisionDataset;
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

/** RF4 · Candidato ao dataset (Garment Vision ou Hard Examples), com consentimento e licença. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "training_candidates")
public class TrainingCandidate extends VersionedAuditableEntity {
    @Column(name = "image_id", nullable = false, length = 36)
    private UUID imageId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "session_id", length = 36)
    private UUID sessionId;

    @Column(name = "review_item_id", length = 36)
    private UUID reviewItemId;

    @Enumerated(EnumType.STRING)
    @Column(name = "dataset", nullable = false, length = 30)
    private VisionDataset dataset;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private TrainingCandidateStatus status;

    @Column(name = "hard_example_tags", length = 512)
    private String hardExampleTags;

    @Column(name = "annotations_json", columnDefinition = "json")
    private String annotationsJson;

    @Column(name = "annotation_version", nullable = false, length = 40)
    private String annotationVersion;

    @Column(name = "source_id", nullable = false, length = 36)
    private UUID sourceId;

    @Column(name = "license", nullable = false, length = 160)
    private String license;

    @Column(name = "consent_granted_at")
    private Instant consentGrantedAt;

    @Column(name = "exported_at")
    private Instant exportedAt;
}
