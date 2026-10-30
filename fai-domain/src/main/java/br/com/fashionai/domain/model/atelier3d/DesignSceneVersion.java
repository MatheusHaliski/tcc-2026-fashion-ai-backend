package br.com.fashionai.domain.model.atelier3d;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Getter @Setter @Entity
@Table(name="atelier_3d_versions",uniqueConstraints={@UniqueConstraint(columnNames={"project_id","sequence_number"}),@UniqueConstraint(columnNames={"project_id","request_id"})})
public class DesignSceneVersion extends AuditableEntity {
    @Column(nullable=false,length=36) private UUID projectId;
    @Column(nullable=false,length=36) private UUID assetId;
    @Column(nullable=false) private long sequenceNumber;
    @Column(nullable=false,length=160) private String author;
    @Column(nullable=false,length=80) private String requestId;
    @Column(nullable=false,length=64) private String digest;
    @Column(nullable=false,columnDefinition="LONGTEXT") private String documentJson;
    @Column(nullable=false,columnDefinition="LONGTEXT") private String genderEvidenceJson;
    @Column(length=36) private UUID tipoLookId;
}
