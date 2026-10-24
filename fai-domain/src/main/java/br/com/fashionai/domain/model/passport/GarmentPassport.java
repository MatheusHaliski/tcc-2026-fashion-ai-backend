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
@Table(name = "garment_passports")
public class GarmentPassport extends VersionedAuditableEntity {
    @Column(name = "piece_id", nullable = false, unique = true, length = 36)
    private UUID pieceId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    @Column(length = 30)
    private String origin;

    @Column(length = 1000)
    private String composition;

    @Column(length = 1000)
    private String care;

    @Column(name = "pending_transfer_id", length = 36)
    private UUID pendingTransferId;

    @Column(name = "state_updated_at", nullable = false)
    private Instant stateUpdatedAt;
}
