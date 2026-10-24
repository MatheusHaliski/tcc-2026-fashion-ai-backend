package br.com.fashionai.domain.model.atelierproject;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;
@Getter @Setter @NoArgsConstructor @Entity @Table(name="atelier_project_votes",uniqueConstraints=@UniqueConstraint(name="uq_atelier_vote",columnNames={"revision_id","user_id"}))
public class DesignVote extends VersionedAuditableEntity {
@Column(nullable=false,length=36) private UUID projectId;
@Column(nullable=false,length=36) private UUID revisionId;
@Column(nullable=false,length=36) private UUID userId;
@Column(nullable=false) private boolean interested;
}
