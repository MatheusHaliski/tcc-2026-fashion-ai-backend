package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.LensIntent;
import br.com.fashionai.domain.model.enums.LensScanStatus;
import br.com.fashionai.domain.model.enums.LensSource;
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
 * RF54 · FashionAI Lens — um scan por imagem (camada estável: a foto e o que foi lido nela). É sempre privado: só o dono
 * vê, nunca entra em ranking, Hype nem estatística pública. A imagem fica em chave privada ({@code restricted/…}), já sem
 * EXIF/GPS. Sem salvar como inspiração, expira em {@code expires_at} e o job diário apaga a imagem e as linhas.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "lens_scans")
public class LensScan extends VersionedAuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LensSource source;

    /** Peça ou look do app analisado (origem IN_APP_PIECE / IN_APP_LOOK). */
    @Column(name = "source_ref_id", length = 36)
    private UUID sourceRefId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LensIntent intent = LensIntent.IDENTIFY;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LensScanStatus status;

    /** NO_FASHION_FOUND, CONSENT_REQUIRED, QUOTA ou FAILED (o motivo de um estado degradado). */
    @Column(name = "error_code", length = 40)
    private String errorCode;

    @Column(name = "image_key", length = 512)
    private String imageKey;

    @Column(name = "thumb_key", length = 512)
    private String thumbKey;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    /** Rostos borrados no aparelho antes do envio (informado pelo cliente). */
    @Column(name = "faces_redacted", nullable = false)
    private int facesRedacted;

    /**
     * O cliente confirmou a proteção dos rostos (o borrão rodou no aparelho ou a pessoa confirmou que a foto não mostra
     * rostos). Sem confirmação a imagem não vai para IA externa: o {@code LensService} faz só a leitura local.
     */
    @Column(name = "redaction_confirmed", nullable = false)
    private boolean redactionConfirmed;

    /** "ia" (visão remota) ou "local" (leitura degradada, sem IA externa). */
    @Column(name = "ai_source", nullable = false, length = 10)
    private String aiSource;

    @Column(name = "model_version", nullable = false, length = 160)
    private String modelVersion;

    @Column(name = "algorithm_version", nullable = false, length = 20)
    private String algorithmVersion;

    /** Registro da inferência da detecção (ai_inference_log) — custo por scan sem guardar imagem. */
    @Column(name = "ai_inference_id", length = 36)
    private UUID aiInferenceId;

    /** Salvo como inspiração: não expira. */
    @Column(name = "saved_at")
    private Instant savedAt;

    /** Quando o scan não salvo será apagado (nulo enquanto estiver salvo). */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "processed_at")
    private Instant processedAt;
}
