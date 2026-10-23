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
@Entity @Table(name="product_size_charts")
public class ProductSizeChart extends VersionedAuditableEntity {
    @Column(name="product_id", nullable=false, length=36) private UUID productId;
    @Column(name="revision", nullable=false) private int revision = 1;
    @Column(name="chart_json", nullable=false, columnDefinition="json") private String chartJson;
    @Column(name="reviewer_id", nullable=false, length=36) private UUID reviewerId;
}
