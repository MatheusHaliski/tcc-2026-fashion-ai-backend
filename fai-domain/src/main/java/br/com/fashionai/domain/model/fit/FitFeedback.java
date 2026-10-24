package br.com.fashionai.domain.model.fit;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="fit_feedback")
public class FitFeedback extends VersionedAuditableEntity {
    @Column(name="owner_id", nullable=false, length=36) private UUID ownerId;
    @Column(name="recommendation_id", nullable=false, length=36) private UUID recommendationId;
    @Column(name="experience_key", nullable=false, length=80) private String experienceKey;
    @Column(name="feedback_json", nullable=false, columnDefinition="json") private String feedbackJson;
}
