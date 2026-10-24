package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

/** Entitlement, never a spendable balance. Only trusted application services grant rewards. */
@Getter @Setter @NoArgsConstructor @Entity @Table(name="atelier_reward_grants")
public class AtelierRewardGrant extends VersionedAuditableEntity {
 public enum Category {auraSignature,garmentMemory,habitableTrofeus,directorPower,collectiveWork,seasonPasses}
 @Column(name="owner_id",nullable=false,length=36) private UUID ownerId;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=30) private Category category;
 @Column(name="reward_code",nullable=false,length=80) private String rewardCode;
 @Column(nullable=false,length=140) private String title;
 @Column(nullable=false,length=1200) private String description;
 @Column(name="source_type",nullable=false,length=30) private String sourceType;
 @Column(name="source_reference",nullable=false,length=160) private String sourceReference;
 @Column(name="reference_id",length=160) private String referenceId;
 @Column(name="expires_at") private Instant expiresAt;
 @Column(nullable=false) private boolean revoked;
}
