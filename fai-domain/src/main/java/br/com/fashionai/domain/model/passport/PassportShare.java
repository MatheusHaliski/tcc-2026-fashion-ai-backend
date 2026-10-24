package br.com.fashionai.domain.model.passport;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.UUID;
import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "passport_shares")
public class PassportShare extends VersionedAuditableEntity {
    @Column(name = "passport_id", nullable = false, length = 36)
    private UUID passportId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false, length = 160)
    private String fields;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;
}
