package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF47 · Apelido de produto ("AF1" → Air Force 1). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "catalog_product_aliases")
public class CatalogProductAlias extends VersionedAuditableEntity {
    @Column(name = "product_id", nullable = false, length = 36)
    private UUID productId;

    @Column(name = "alias", nullable = false, length = 160)
    private String alias;

    @Column(name = "alias_norm", nullable = false, length = 160)
    private String aliasNorm;
}
