package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Base de conhecimento: modelo de produto (tokens de OCR e padrão de código). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "kb_product_models")
public class KbProductModel extends VersionedAuditableEntity {
    @Column(name = "product_line_id", length = 36)
    private UUID productLineId;

    @Column(name = "brand_slug", nullable = false, length = 160)
    private String brandSlug;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "subcategory", length = 120)
    private String subcategory;

    @Column(name = "ocr_tokens", length = 255)
    private String ocrTokens;

    @Column(name = "code_pattern", length = 255)
    private String codePattern;

    @Column(name = "known_colors", length = 255)
    private String knownColors;

    @Column(name = "known_materials", length = 255)
    private String knownMaterials;
}
