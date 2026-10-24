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
@Table(name = "passport_holdings")
public class PassportHolding extends VersionedAuditableEntity {
    @Column(name = "passport_id", nullable = false, length = 36)
    private UUID passportId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    @Column(name = "piece_id", nullable = false, length = 36)
    private UUID pieceId;

    @Column(name = "active_passport_id", unique = true, length = 36)
    private UUID activePassportId;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;
}
