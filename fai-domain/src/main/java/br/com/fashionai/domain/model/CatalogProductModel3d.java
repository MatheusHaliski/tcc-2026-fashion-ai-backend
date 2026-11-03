package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.CatalogModelStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Etapa 3 — modelo 3D de vitrine de um produto do catálogo (ex.: .glb da Meshy importado do lote do Codex). Sem
 * esqueleto e sem métricas de vestir: aparece onde a peça é mostrada como objeto (manequim, Meu Quarto 3D, visualizador
 * da peça, card expandido), nunca no avatar que se mexe. Diferente do {@link GarmentAsset3d}, que é feito para vestir e
 * passa pelo GarmentFitGate. Gravado por {@code scripts/catalog/import_meshy_glbs.py}; o app só lê.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "catalog_product_models_3d")
public class CatalogProductModel3d extends VersionedAuditableEntity {
    @Column(name = "catalog_product_id", nullable = false, length = 36)
    private UUID catalogProductId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CatalogModelStatus status = CatalogModelStatus.DRAFT;

    /** Origem: GENERATED (IA), ARTIST, SCAN. */
    @Column(nullable = false, length = 20)
    private String source;

    @Column(length = 40)
    private String generator;

    @Column(nullable = false, length = 64)
    private String sha256;

    /** Arquivos por perfil: {"WEB": {"key", "bytes", "triangles", "sha256", "recipe"}, "DESKTOP_HIGH": {...}}. */
    @Column(name = "renditions_json", nullable = false, columnDefinition = "json")
    private String renditionsJson;

    @Column(name = "metrics_json", columnDefinition = "json")
    private String metricsJson;

    @Column(name = "review_notes", length = 1000)
    private String reviewNotes;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "published_by", length = 80)
    private String publishedBy;
}
