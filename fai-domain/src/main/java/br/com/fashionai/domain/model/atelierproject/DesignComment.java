package br.com.fashionai.domain.model.atelierproject;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;
@Getter @NoArgsConstructor @Entity @Table(name="atelier_project_comments",uniqueConstraints=@UniqueConstraint(name="uq_atelier_comment_request",columnNames={"project_id","author_id","request_id"}))
public class DesignComment extends AuditableEntity {
@Column(nullable=false,length=36,updatable=false) private UUID projectId;
@Column(nullable=false,length=36,updatable=false) private UUID revisionId;
@Column(nullable=false,length=36,updatable=false) private UUID authorId;
@Column(nullable=false,length=100,updatable=false) private String anchor;
@Column(nullable=false,length=4000,updatable=false) private String body;
@Column(nullable=false,length=80,updatable=false) private String requestId;
public DesignComment(UUID projectId,UUID revisionId,UUID authorId,String anchor,String body,String requestId){this.projectId=projectId;this.revisionId=revisionId;this.authorId=authorId;this.anchor=anchor;this.body=body;this.requestId=requestId;}
}
