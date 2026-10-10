package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.LensDetectionStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * RF54 · Uma peça encontrada no scan (caixa em % da imagem + atributos da taxonomia). Correções da pessoa sobrescrevem os
 * atributos (o antes/depois fica em {@code lens_feedback}); o embedding visual do recorte fica, para a semelhança.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "lens_detections")
public class LensDetection extends VersionedAuditableEntity {
    @Column(name = "scan_id", nullable = false, length = 36)
    private UUID scanId;

    /** Ordem de leitura (de cima para baixo). */
    @Column(nullable = false)
    private int ordinal;

    /** {x, y, w, h} em % (0–100) da imagem, canto superior esquerdo. */
    @Column(name = "box_json", nullable = false, columnDefinition = "json")
    private String boxJson;

    /** Nome descritivo ("Jaqueta jeans"). */
    @Column(length = 120)
    private String label;

    @Column(length = 40)
    private String category;

    @Column(length = 60)
    private String subcategory;

    @Column(length = 20)
    private String material;

    @Column(length = 12)
    private String sex;

    /** [{name, hex, share}] com a cor principal primeiro (códigos da paleta oficial). */
    @Column(name = "colors_json", columnDefinition = "json")
    private String colorsJson;

    /** solid, striped, checked ou printed (PatternAnalyzer ou correção). */
    @Column(length = 20)
    private String pattern;

    @Column(name = "style_tags", length = 255)
    private String styleTags;

    @Column(name = "occasion_tags", length = 255)
    private String occasionTags;

    @Column(precision = 4, scale = 3)
    private BigDecimal confidence;

    @Column(name = "attribute_confidence_json", columnDefinition = "json")
    private String attributeConfidenceJson;

    @Column(name = "embedding_json", columnDefinition = "json")
    private String embeddingJson;

    @Column(name = "embedding_model", length = 120)
    private String embeddingModel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LensDetectionStatus status = LensDetectionStatus.DETECTED;

    /** "Não é roupa": some do scan (desfazer limpa o campo e a peça volta ao estado anterior). */
    @Column(name = "dismissed_at")
    private Instant dismissedAt;

    /** "Quero" (lista de desejos dentro das inspirações). */
    @Column(name = "wanted_at")
    private Instant wantedAt;

    /** "Eu tenho": a peça do guarda-roupa que a pessoa disse ser esta. */
    @Column(name = "owned_item_id", length = 36)
    private UUID ownedItemId;
}
