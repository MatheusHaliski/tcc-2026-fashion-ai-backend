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
@Table(name = "passport_evidence", uniqueConstraints = @UniqueConstraint(columnNames = {"passport_id", "controller_id", "command_key"}))
public class PassportEvidence extends VersionedAuditableEntity {
    @Column(name = "passport_id", nullable = false, length = 36)
    private UUID passportId;

    @Column(name = "controller_id", nullable = false, length = 36)
    private UUID controllerId;

    @Column(nullable = false, length = 30)
    private String kind;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "content_ciphertext", columnDefinition = "longtext")
    private String contentBase64;

    @Column(name = "content_hash", length = 64)
    private String contentHash;

    @Column(name = "command_key", nullable = false, length = 80)
    private String commandKey;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
