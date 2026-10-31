package br.com.fashionai.domain.model.atelier3d;

import br.com.fashionai.domain.model.AuditableEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Entity @Table(name="atelier_3d_guests")
public class DesignGuestInvite extends AuditableEntity {
    public enum Role { VIEWER, EDITOR }
    @Column(nullable=false,length=36) private UUID projectId;
    @Column(nullable=false,length=64) private String tokenHash;
    @Column(nullable=false,length=80) private String label;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=16) private Role role;
    @Column(nullable=false) private Instant expiresAt;
    private Instant revokedAt;
    @Column(nullable=false) private boolean allowExport;
}
