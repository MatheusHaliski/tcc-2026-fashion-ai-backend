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
@Entity @Table(name="size_recommendations")
public class SizeRecommendation extends VersionedAuditableEntity {
    @Column(name="owner_id", nullable=false, length=36) private UUID ownerId;
    @Column(name="product_id", nullable=false, length=36) private UUID productId;
    @Column(name="chart_revision") private Integer chartRevision;
    @Column(name="profile_version") private Long profileVersion;
    @Column(name="request_key", nullable=false, length=80) private String requestKey;
    @Column(name="result_json", nullable=false, columnDefinition="json") private String resultJson;
    @Column(name="expires_at", nullable=false) private Instant expiresAt;
}
