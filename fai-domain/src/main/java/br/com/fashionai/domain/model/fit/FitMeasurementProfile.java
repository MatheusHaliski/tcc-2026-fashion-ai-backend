package br.com.fashionai.domain.model.fit;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="fit_measurement_profiles")
public class FitMeasurementProfile extends VersionedAuditableEntity {
    @Column(name="owner_id", nullable=false, unique=true, length=36) private UUID ownerId;
    @Convert(converter=AesGcmStringConverter.class)
    @Column(name="measurements_encrypted", nullable=false, columnDefinition="text") private String measurementsJson;
    @Column(name="measured_at", nullable=false) private Instant measuredAt;
}
