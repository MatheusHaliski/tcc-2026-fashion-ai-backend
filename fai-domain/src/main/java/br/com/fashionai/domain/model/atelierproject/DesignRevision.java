package br.com.fashionai.domain.model.atelierproject;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;
@Getter @NoArgsConstructor @Entity @Table(name="atelier_project_revisions",uniqueConstraints=@UniqueConstraint(name="uq_atelier_revision_request",columnNames={"project_id","request_id"}))
public class DesignRevision extends AuditableEntity {
@Column(nullable=false,length=36,updatable=false) private UUID projectId;
@Column(length=36,updatable=false) private UUID parentRevisionId;
@Column(length=36,updatable=false) private UUID sourceRevisionId;
@Column(nullable=false,length=36,updatable=false) private UUID authorId;
@Column(nullable=false,updatable=false) private int number;
@Column(nullable=false,length=160,updatable=false) private String title;
@Column(nullable=false,length=4000,updatable=false) private String brief;
@Lob @Column(nullable=false,columnDefinition="LONGTEXT",updatable=false) private String specificationJson;
@Column(nullable=false,length=80,updatable=false) private String requestId;
@Column(nullable=false,length=64,updatable=false) private String requestDigest;
@Column(nullable=false,length=60,updatable=false) private String contributionLicense;
@Column(updatable=false) private Instant votingEndsAt;
public DesignRevision(UUID projectId,UUID parentRevisionId,UUID sourceRevisionId,UUID authorId,int number,String title,String brief,String specificationJson,String requestId,String requestDigest,Instant votingEndsAt){this.projectId=projectId;this.parentRevisionId=parentRevisionId;this.sourceRevisionId=sourceRevisionId;this.authorId=authorId;this.number=number;this.title=title;this.brief=brief;this.specificationJson=specificationJson;this.requestId=requestId;this.requestDigest=requestDigest;this.votingEndsAt=votingEndsAt;this.contributionLicense="PROJECT_COLLABORATION_V1";}
}
