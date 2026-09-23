package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ConsentPurpose;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * RF3.CA16-CA21 e RF24.CA15 — consentimento por finalidade. Estado atual por (usuário, finalidade);
 * cada manifestação/revogação também vira evento em audit_log (CA18: data e hora da manifestação).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_consents", uniqueConstraints = @UniqueConstraint(name = "uq_user_consents_purpose", columnNames = {"user_id", "purpose"}))
public class UserConsent extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ConsentPurpose purpose;

    @Column(nullable = false)
    private boolean granted;

    @Column(name = "legal_basis", nullable = false, length = 120)
    private String legalBasis;

    @Column(name = "policy_version", nullable = false, length = 20)
    private String policyVersion;

    @Column(name = "granted_at")
    private Instant grantedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    public UserConsent(User user, ConsentPurpose purpose, String legalBasis, String policyVersion) {
        this.user = user;
        this.purpose = purpose;
        this.legalBasis = legalBasis;
        this.policyVersion = policyVersion;
    }
}
