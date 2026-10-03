package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF47 · Apelido de marca ("PRL" → Ralph Lauren): normalização sem marca duplicada. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "brand_aliases")
public class BrandAlias extends VersionedAuditableEntity {
    @Column(name = "brand_id", nullable = false, length = 36)
    private UUID brandId;

    @Column(name = "alias", nullable = false, length = 160)
    private String alias;

    @Column(name = "alias_norm", nullable = false, length = 160)
    private String aliasNorm;
}
