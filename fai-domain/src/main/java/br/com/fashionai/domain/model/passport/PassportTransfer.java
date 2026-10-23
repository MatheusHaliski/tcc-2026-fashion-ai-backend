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
@Table(name = "passport_transfers", uniqueConstraints = @UniqueConstraint(columnNames = {"passport_id", "from_owner_id", "command_key"}))
public class PassportTransfer extends VersionedAuditableEntity {
    @Column(name = "passport_id", nullable = false, length = 36)
    private UUID passportId;

    @Column(name = "from_owner_id", nullable = false, length = 36)
    private UUID fromOwnerId;

    @Column(name = "recipient_id", nullable = false, length = 36)
    private UUID recipientId;

    @Column(name = "source_piece_id", nullable = false, length = 36)
    private UUID sourcePieceId;

    @Column(name = "recipient_piece_id", length = 36)
    private UUID recipientPieceId;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "command_key", nullable = false, length = 80)
    private String commandKey;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;
}
