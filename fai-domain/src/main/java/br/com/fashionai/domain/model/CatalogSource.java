package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.CatalogSourceType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF47 · Fonte oficial/autorizada de uma marca (domínio) e se ela permite guardar cópia das imagens. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "catalog_sources")
public class CatalogSource extends VersionedAuditableEntity {
    @Column(name = "brand_id", nullable = false, length = 36)
    private UUID brandId;

    @Column(name = "domain", nullable = false, length = 160)
    private String domain;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 30)
    private CatalogSourceType sourceType;

    @Column(name = "country", length = 2)
    private String country;

    @Column(name = "allows_image_persistence", nullable = false)
    private boolean allowsImagePersistence;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "notes", length = 512)
    private String notes;
}
