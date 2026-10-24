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
@Table(name = "passport_events", uniqueConstraints = @UniqueConstraint(columnNames = {"passport_id", "author_id", "command_key"}))
public class PassportEvent extends VersionedAuditableEntity {
    @Column(name = "passport_id", nullable = false, length = 36)
    private UUID passportId;

    @Column(name = "author_id", nullable = false, length = 36)
    private UUID authorId;

    @Column(nullable = false, length = 30)
    private String kind;

    @Column(length = 4096)
    private String notes;

    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @Column(name = "corrects_event_id", length = 36)
    private UUID correctsEventId;

    @Column(name = "command_key", nullable = false, length = 80)
    private String commandKey;
}
