package br.com.fashionai.domain.model.atelier3d;

import br.com.fashionai.domain.model.AuditableEntity;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

/** Private immutable originals; no public bucket URL exposes a collaborator's source. */
@Getter @Setter @Entity @Table(name="atelier_3d_assets")
public class DesignAsset extends AuditableEntity {
    @Column(nullable=false,length=36) private UUID projectId;
    @Column(nullable=false,length=160) private String filename;
    @Column(nullable=false,length=64) private String sha256;
    @Column(nullable=false) private int bytes;
    @Column(nullable=false,columnDefinition="LONGTEXT") private String inspectionJson;
    @Convert(converter=AesGcmStringConverter.class)
    @Column(nullable=false,columnDefinition="LONGTEXT") private String contentBase64;
}
