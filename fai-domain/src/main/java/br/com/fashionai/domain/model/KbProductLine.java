package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Base de conhecimento: linha de produto de uma marca. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "kb_product_lines")
public class KbProductLine extends VersionedAuditableEntity {
    @Column(name = "brand_slug", nullable = false, length = 160)
    private String brandSlug;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "categories", length = 255)
    private String categories;

    @Column(name = "ocr_tokens", length = 255)
    private String ocrTokens;
}
