package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ModerationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * RF40 — Meu Avatar 3D: o rosto/busto da própria pessoa (forma em pose neutra + pele + cabelo medidos na foto),
 * confirmado por ela. A textura do rosto (atlas) é biométrica: fica em chave privada do storage e só sai pela API.
 * Um por usuário; refazer substitui; excluir apaga o modelo e a textura (o manequim volta ao rosto padrão).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_avatars_3d")
public class UserAvatar3d extends VersionedAuditableEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

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

    @Column(name = "public_on_runway", nullable = false)
    private boolean publicOnRunway = true;

    @Column(name = "consent_at", nullable = false)
    private Instant consentAt;

    /**
     * Moderação da textura do rosto (a foto não passa pelo filtro de upload): só textura APPROVED aparece para outras
     * pessoas quando o avatar é público. Textura nova volta a PENDING.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "texture_moderation", nullable = false, length = 30)
    private ModerationStatus textureModeration = ModerationStatus.PENDING;
}
