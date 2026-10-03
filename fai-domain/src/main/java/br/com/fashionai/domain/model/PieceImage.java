package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.CapturePurpose;
import br.com.fashionai.domain.model.enums.CaptureRole;
import br.com.fashionai.domain.model.enums.CaptureSource;
import br.com.fashionai.domain.model.enums.CaptureView;
import br.com.fashionai.domain.model.enums.PieceImageStatus;
import br.com.fashionai.domain.model.enums.PieceImageType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** RF4 · Asset de imagem da peça. ORIGINAL nunca é sobrescrito (chave única); os demais derivam dele. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "piece_images")
public class PieceImage extends VersionedAuditableEntity {
    @Column(name = "session_id", length = 36)
    private UUID sessionId;

    @Column(name = "piece_id", length = 36)
    private UUID pieceId;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "image_type", nullable = false, length = 30)
    private PieceImageType imageType;

    @Enumerated(EnumType.STRING)
    @Column(name = "view_type", nullable = false, length = 30)
    private CaptureView viewType;

    @Enumerated(EnumType.STRING)
    @Column(name = "capture_role", length = 20)
    private CaptureRole captureRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "capture_purpose", length = 40)
    private CapturePurpose capturePurpose;

    @Enumerated(EnumType.STRING)
    @Column(name = "capture_source", length = 20)
    private CaptureSource captureSource;

    @Column(name = "storage_key", nullable = false, updatable = false, length = 512)
    private String storageKey;

    @Column(name = "url", nullable = false, length = 1024)
    private String url;

    @Column(name = "mime_type", nullable = false, length = 40)
    private String mimeType;

    @Column(name = "width", nullable = false)
    private int width;

    @Column(name = "height", nullable = false)
    private int height;

    @Column(name = "orientation", nullable = false, length = 12)
    private String orientation;

    @Column(name = "bytes_size")
    private Long bytesSize;

    @Column(name = "sha256", length = 64)
    private String sha256;

    @Column(name = "quality_score")
    private Integer qualityScore;

    @Column(name = "blur_score", precision = 5, scale = 4)
    private BigDecimal blurScore;

    @Column(name = "lighting_score", precision = 5, scale = 4)
    private BigDecimal lightingScore;

    @Column(name = "garment_coverage", precision = 5, scale = 4)
    private BigDecimal garmentCoverage;

    @Column(name = "detected_category", length = 80)
    private String detectedCategory;

    @Column(name = "detected_subcategory", length = 120)
    private String detectedSubcategory;

    @Column(name = "photography_spec", length = 60)
    private String photographySpec;

    @Column(name = "derived_from_id", length = 36)
    private UUID derivedFromId;

    @Enumerated(EnumType.STRING)
    @Column(name = "processing_status", nullable = false, length = 20)
    private PieceImageStatus processingStatus;

    @Column(name = "model_version", length = 120)
    private String modelVersion;

    @Column(name = "analysis_json", columnDefinition = "json")
    private String analysisJson;

    @Column(name = "superseded", nullable = false)
    private boolean superseded;
}
