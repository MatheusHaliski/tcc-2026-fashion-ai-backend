package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.CatalogOrigin;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Catálogo de marcas referenciado por ClothesPiece.brandId (taxonomia §brand). SEEDED = carga inicial;
 * AUTO_DETECTED = criado pelo Brand Resolver (RF24) somente após regex + dedup + validação externa —
 * nunca por omissão.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "brands")
public class Brand extends VersionedAuditableEntity {
    @Column(nullable = false, length = 160)
    private String name;

    @Column(nullable = false, unique = true, length = 160)
    private String slug;

    @Column(name = "logo_url", length = 1024)
    private String logoUrl;

    @Column(length = 1024)
    private String website;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BrandSource source = BrandSource.SEEDED;

    /** Origem no catálogo global (V30): o reset de usuários demo NUNCA apaga marca; DEMO só sai pelo reset de catálogo. */
    @Enumerated(EnumType.STRING)
    @Column(name = "catalog_origin", nullable = false, length = 20)
    private CatalogOrigin catalogOrigin = CatalogOrigin.REAL;

    @Column(name = "fixture_key", length = 80, unique = true)
    private String fixtureKey;

    @Column(name = "source_confidence", precision = 5, scale = 4)
    private BigDecimal sourceConfidence;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(length = 2)
    private String country;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_profile_id")
    private BrandProfile brandProfile;

    public Brand(String name, String slug, BrandSource source) {
        this.name = name;
        this.slug = slug;
        this.source = source;
    }
}
