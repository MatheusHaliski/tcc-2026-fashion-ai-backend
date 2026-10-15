package br.com.fashionai.domain.model;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;
@Getter @Setter @NoArgsConstructor @Entity @Table(name="flair_adventure_sessions")
public class FlairAdventureSession extends VersionedAuditableEntity {
 @Column(name="owner_id",nullable=false,length=36) private UUID ownerId;
 @Column(nullable=false,length=20) private String status="ACTIVE";
 @Column(name="state_json",nullable=false,columnDefinition="json") private String stateJson;
}
