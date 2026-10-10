package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Orientação "Como funciona" por pessoa e por tutorial (docs/ux/ORIENTACAO.md). Cada tutorial tem versão: só uma mudança
 * relevante de funcionamento sobe a versão e reapresenta a explicação; ajuste cosmético não. "Não mostrar novamente"
 * vale para aquele tutorial e aquela versão, nunca para os outros.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_guides")
public class UserGuide extends AuditableEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "guide_key", nullable = false, length = 60)
    private String guideKey;

    /** Versão do tutorial que a pessoa viu (ou escondeu). */
    @Column(nullable = false)
    private int version;

    /** "Não mostrar novamente" marcado nesta versão. */
    @Column(nullable = false)
    private boolean hidden;

    /** Quantas vezes abriu sozinho nesta versão (sem a pessoa pedir). */
    @Column(name = "auto_count", nullable = false)
    private int autoCount;

    @Column(name = "last_shown_at")
    private Instant lastShownAt;
}
