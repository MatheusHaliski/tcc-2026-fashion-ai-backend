package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.HypeEntityType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Embedding vetorial por peça/esquema (Acervo Grouping #13, Affinity #14, Photo Curator #19). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "item_embeddings", uniqueConstraints = @UniqueConstraint(name = "uq_item_embeddings", columnNames = {"entity_type", "entity_id"}))
public class ItemEmbedding extends VersionedAuditableEntity {
    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 10)
    private HypeEntityType entityType;

    @Column(name = "entity_id", nullable = false, length = 36)
    private UUID entityId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "provider", nullable = false, length = 60)
    private String provider;

    @Column(name = "dimensions", nullable = false)
    private int dimensions;

    @Column(name = "vector_json", columnDefinition = "json", nullable = false)
    private String vectorJson;
}
