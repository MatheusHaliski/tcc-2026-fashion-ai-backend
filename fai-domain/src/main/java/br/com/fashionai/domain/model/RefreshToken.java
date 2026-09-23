package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * RNF2 — refresh token rotativo (armazenado só como hash). Cada família representa uma sessão ativa
 * exibida em "Sessões ativas" (RF3.CA32); logout invalida no servidor (RF3.CA31).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true, length = 128)
    private String tokenHash;

    @Column(name = "family_id", nullable = false, length = 36)
    private UUID familyId;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "rotated_from_id", length = 36)
    private UUID rotatedFromId;

    @Column(name = "created_ip", length = 80)
    private String createdIp;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "device_name", length = 160)
    private String deviceName;

    @Column(name = "location_approx", length = 120)
    private String locationApprox;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @Column(name = "persistent", nullable = false)
    private boolean persistent = true;

    public boolean isActive(Instant now) {
        return revokedAt == null && now.isBefore(expiresAt);
    }
}
