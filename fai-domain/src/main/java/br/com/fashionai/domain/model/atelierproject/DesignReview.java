package br.com.fashionai.domain.model.atelierproject;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;
@Getter @NoArgsConstructor @Entity @Table(name="atelier_project_reviews",uniqueConstraints=@UniqueConstraint(name="uq_atelier_review_request",columnNames={"project_id","author_id","request_id"}))
public class DesignReview extends AuditableEntity {
@Column(nullable=false,length=36,updatable=false) private UUID projectId;
@Column(nullable=false,length=36,updatable=false) private UUID revisionId;
@Column(nullable=false,length=36,updatable=false) private UUID authorId;
@Enumerated(EnumType.STRING) @Column(nullable=false,length=30,updatable=false) private Decision decision;
@Column(nullable=false,length=4000,updatable=false) private String notes;
@Column(nullable=false,length=80,updatable=false) private String requestId;
public enum Decision { REQUEST_CHANGES, APPROVE_SHOWCASE }
public DesignReview(UUID projectId,UUID revisionId,UUID authorId,Decision decision,String notes,String requestId){this.projectId=projectId;this.revisionId=revisionId;this.authorId=authorId;this.decision=decision;this.notes=notes;this.requestId=requestId;}
}
