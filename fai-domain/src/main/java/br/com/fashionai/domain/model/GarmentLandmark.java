package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Landmark da peça numa imagem (coordenadas normalizadas), com o modelo que o produziu. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "garment_landmarks")
public class GarmentLandmark extends VersionedAuditableEntity {
    @Column(name = "image_id", nullable = false, length = 36)
    private UUID imageId;

    @Column(name = "name", nullable = false, length = 60)
    private String name;

    @Column(name = "x", nullable = false, precision = 6, scale = 5)
    private BigDecimal x;

    @Column(name = "y", nullable = false, precision = 6, scale = 5)
    private BigDecimal y;

    @Column(name = "confidence", nullable = false, precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "visible", nullable = false)
    private boolean visible;

    @Column(name = "model_version", nullable = false, length = 120)
    private String modelVersion;
}
