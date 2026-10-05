package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.IdentityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
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

import java.time.Instant;
import java.util.UUID;

/**
 * AVATAR-ID I1 — uma versão da identidade do avatar (o {@code CanonicalAvatarIdentity} versionado da auditoria de
 * identidade). Cada reconstrução ou correção cria uma versão nova; refazer não apaga a versão aprovada. A textura do
 * rosto de cada versão é biométrica: chave privada no storage, nunca em log.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "avatar_identity_versions")
public class AvatarIdentityVersion extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Estável entre versões (o mesmo para todas as versões da pessoa). */
    @Column(name = "identity_id", nullable = false, length = 36)
    private UUID identityId;

    @Column(name = "version_no", nullable = false)
    private int versionNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private IdentityStatus status = IdentityStatus.DRAFT;

    /** Versão de onde esta saiu (reconstrução: a atual de antes; restauração: a restaurada). */
    @Column(name = "based_on")
    private Integer basedOn;

    @Column(name = "model_version", nullable = false)
    private int modelVersion;

    @Column(name = "model_json", nullable = false, columnDefinition = "json")
    private String modelJson;

    @Column(name = "adjust_json", columnDefinition = "json")
    private String adjustJson;

    @Column(name = "texture_key", nullable = false, length = 512)
    private String textureKey;

    @Column(name = "photos_count", nullable = false)
    private int photosCount = 1;

    @Column(name = "warnings_json", columnDefinition = "json")
    private String warningsJson;

    /** Relatório do gate: só números agregados e os nomes das métricas (nunca forma, cor ou pontos). */
    @Column(name = "quality_json", columnDefinition = "json")
    private String qualityJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "texture_moderation", nullable = false, length = 30)
    private ModerationStatus textureModeration = ModerationStatus.PENDING;

    @Column(name = "approved_at")
    private Instant approvedAt;

    /** Aprovada pela pessoa mesmo com métricas reprovadas no gate. */
    @Column(name = "approved_with_warnings", nullable = false)
    private boolean approvedWithWarnings;
}
