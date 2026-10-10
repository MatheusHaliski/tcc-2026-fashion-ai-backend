package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.GarmentAssetStatus;
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
 * MP-2 — Asset 3D de roupa que veste o avatar canônico (esqueleto {@code rigStandard}) no cliente Unreal. Diferente do
 * {@code wardrobe_items.model3d_url} (RF16: GLB de vitrine, sem esqueleto nem aprovação), este asset é feito para vestir:
 * malha com pesos no esqueleto do avatar, níveis de detalhe por perfil de qualidade e métricas de vestir medidas.
 * Uma peça sem asset APPROVED aparece no provador como prévia 2D identificada.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "garment_assets_3d")
public class GarmentAsset3d extends VersionedAuditableEntity {
    @Column(name = "piece_id", length = 36)
    private UUID pieceId;

    @Column(name = "catalog_product_id", length = 36)
    private UUID catalogProductId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GarmentAssetStatus status = GarmentAssetStatus.DRAFT;

    /** Esqueleto/corpo base a que os pesos se referem (ex.: FAI_BODY_V1, o corpo MPFB2 do avatar). */
    @Column(name = "rig_standard", nullable = false, length = 40)
    private String rigStandard;

    /** Origem: ARTIST, PATTERN (molde paramétrico), SCAN, GENERATED (ex.: Meshy + retopologia). */
    @Column(nullable = false, length = 20)
    private String source;

    /** Logos/estampas de marca: NONE, AUTHORIZED (com referência da autorização) ou PENDING (não pode aprovar). */
    @Column(name = "logo_authorization", nullable = false, length = 20)
    private String logoAuthorization = "NONE";

    @Column(name = "logo_authorization_ref", length = 200)
    private String logoAuthorizationRef;

    /** Métricas de vestir medidas no corpo de referência e nas poses de teste (GarmentFitGate). */
    @Column(name = "metrics_json", columnDefinition = "json")
    private String metricsJson;

    /** Arquivos por perfil de qualidade: {"MOBILE_LOW": {"key", "bytes", "triangles", "sha256"}, ...}. */
    @Column(name = "renditions_json", columnDefinition = "json")
    private String renditionsJson;

    @Column(name = "review_notes", length = 1000)
    private String reviewNotes;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_by", length = 80)
    private String approvedBy;
}
