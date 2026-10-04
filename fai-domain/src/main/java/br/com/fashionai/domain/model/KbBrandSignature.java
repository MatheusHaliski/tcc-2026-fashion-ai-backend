package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Base de conhecimento: sinal visual/textual característico de uma marca. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "kb_brand_signatures")
public class KbBrandSignature extends VersionedAuditableEntity {
    @Column(name = "brand_name", nullable = false, length = 160)
    private String brandName;

    @Column(name = "brand_slug", nullable = false, length = 160)
    private String brandSlug;

    @Column(name = "signal_type", nullable = false, length = 30)
    private String signalType;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "description", length = 512)
    private String description;

    @Column(name = "typical_regions", length = 255)
    private String typicalRegions;

    @Column(name = "categories", length = 255)
    private String categories;

    @Column(name = "ocr_tokens", length = 255)
    private String ocrTokens;

    @Column(name = "weight", nullable = false, precision = 4, scale = 3)
    private BigDecimal weight;
}
