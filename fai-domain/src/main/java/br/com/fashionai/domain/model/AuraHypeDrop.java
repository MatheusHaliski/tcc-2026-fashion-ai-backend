package br.com.fashionai.domain.model;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;
@Getter @Setter @NoArgsConstructor @Entity
@Table(name="aura_hype_drops",uniqueConstraints={@UniqueConstraint(columnNames={"entity_type","entity_id"}),@UniqueConstraint(columnNames={"issuer_id","series_code","serial_number"})})
public class AuraHypeDrop extends VersionedAuditableEntity {
 @Enumerated(EnumType.STRING) @Column(name="entity_type",nullable=false,length=10) private HypeEntityType entityType;
 @Column(name="entity_id",nullable=false,length=36) private UUID entityId;
 @Column(name="issuer_id",nullable=false,length=36) private UUID issuerId;
 @Column(name="series_code",nullable=false,length=60) private String seriesCode;
 @Column(nullable=false,length=120) private String label;
 @Column(name="serial_number",nullable=false) private int serial;
 @Column(name="print_run",nullable=false) private int total;
 @Column(nullable=false) private boolean active=true;
}
