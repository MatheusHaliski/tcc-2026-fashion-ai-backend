package br.com.fashionai.domain.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

/** Private personalized render, never a public catalog asset or a spendable reward. */
@Getter @Setter @NoArgsConstructor @Entity @Table(name="aura_motion_jobs")
public class AuraMotionJob extends VersionedAuditableEntity {
 public enum Status {QUEUED,SUBMITTING,PROCESSING,READY,FAILED,CANCELLED}
 @Column(name="owner_id",nullable=false,length=36) private UUID ownerId;
 @Column(name="piece_id",nullable=false,length=36) private UUID pieceId;
 @Column(name="request_key",nullable=false,length=36) private UUID requestKey;
 @Column(name="piece_revision",nullable=false) private long pieceRevision;
 @Column(name="source_url",nullable=false,length=2048) private String sourceUrl;
 @Column(name="source_hash",nullable=false,length=64) private String sourceHash;
 @Column(name="context_json",nullable=false,columnDefinition="json") private String contextJson;
 @Column(name="template_id",nullable=false,length=40) private String templateId;
 @Column(name="consented_at",nullable=false) private Instant consentedAt;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private Status status;
 @Column(name="provider_job_id",length=200) private String providerJobId;
 @Column(name="media_url",length=2048) private String mediaUrl;
 @Column(name="failure_code",length=80) private String failureCode;
 @Column(nullable=false) private int attempts;
 @Column(name="submitted_at") private Instant submittedAt;
}
