package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Código/link transacional (confirmação de e-mail, troca de e-mail, 2FA, redefinição de senha).
 * Só o hash do código é persistido; o destino novo (troca de e-mail) fica cifrado (RNF3).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "verification_codes")
public class VerificationCode extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private VerificationPurpose purpose;

    @Column(name = "code_hash", nullable = false, length = 128)
    private String codeHash;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "target_ciphertext", length = 1024)
    private String target;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "send_count", nullable = false)
    private int sendCount = 1;

    @Column(name = "last_sent_at", nullable = false)
    private Instant lastSentAt;

    public boolean isUsable(Instant now) {
        return consumedAt == null && now.isBefore(expiresAt) && attempts < 5;
    }
}
