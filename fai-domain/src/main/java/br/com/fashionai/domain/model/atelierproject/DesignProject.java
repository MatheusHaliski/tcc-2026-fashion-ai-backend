package br.com.fashionai.domain.model.atelierproject;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.Visibility;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;
@Getter @Setter @NoArgsConstructor @Entity @Table(name="atelier_projects",uniqueConstraints=@UniqueConstraint(name="uq_atelier_creation",columnNames={"owner_id","creation_key"}))
public class DesignProject extends VersionedAuditableEntity {
@Column(nullable=false,length=36) private UUID ownerId;
@Column(nullable=false,length=160) private String title;
@Column(nullable=false,length=4000) private String brief;
@Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private Visibility visibility;
@Enumerated(EnumType.STRING) @Column(nullable=false,length=35) private State state;
@Lob @Column(nullable=false,columnDefinition="LONGTEXT") private String specificationJson;
@Column(length=36) private UUID latestRevisionId;
@Column(nullable=false) private int revisionNumber;
@Column(nullable=false,length=80) private String creationKey;
@Column(nullable=false) private Instant activityAt;
public enum State { DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED_FOR_SHOWCASE, ARCHIVED }
}
