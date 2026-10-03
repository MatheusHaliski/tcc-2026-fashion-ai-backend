package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Embedding visual por imagem e versão de modelo; só com consentimento de treinamento. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "garment_embeddings")
public class GarmentEmbedding extends VersionedAuditableEntity {
    @Column(name = "image_id", nullable = false, length = 36)
    private UUID imageId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "model_version", nullable = false, length = 120)
    private String modelVersion;

    @Column(name = "dimensions", nullable = false)
    private int dimensions;

    @Column(name = "vector_json", nullable = false, columnDefinition = "json")
    private String vectorJson;

    @Column(name = "category", length = 80)
    private String category;

    @Column(name = "subcategory", length = 120)
    private String subcategory;

    @Column(name = "brand", length = 160)
    private String brand;

    @Column(name = "label_source", nullable = false, length = 30)
    private String labelSource;
}
