package br.com.fashionai.domain.model.atelierproject;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;
@Getter @Setter @NoArgsConstructor @Entity @Table(name="atelier_project_members",uniqueConstraints=@UniqueConstraint(name="uq_atelier_member",columnNames={"project_id","user_id"}))
public class DesignProjectMember extends VersionedAuditableEntity {
@Column(nullable=false,length=36) private UUID projectId;
@Column(nullable=false,length=36) private UUID userId;
@Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private Role role;
@Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private Status status;
@Column(nullable=false) private Instant expiresAt;
@Column private Instant acceptedAt;
public enum Role { OWNER, EDITOR, REVIEWER, VIEWER }
public enum Status { INVITED, ACCEPTED, REVOKED }
}
