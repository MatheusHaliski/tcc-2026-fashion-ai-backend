package br.com.fashionai.domain.model.passport;

import br.com.fashionai.domain.model.VersionedAuditableEntity;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Recibo privado emitido pelo prestador (PNG re-codificado, cifrado); nunca aparece no QR público. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "passport_repair_receipts", uniqueConstraints = @UniqueConstraint(name = "uq_repair_receipt_command", columnNames = {"order_id", "provider_id", "command_key"}))
public class PassportRepairReceipt extends VersionedAuditableEntity {
    @Column(name = "order_id", nullable = false, length = 36)
    private UUID orderId;

    @Column(name = "provider_id", nullable = false, length = 36)
    private UUID providerId;

    @Convert(converter = AesGcmStringConverter.class)
    @Column(name = "content_ciphertext", columnDefinition = "LONGTEXT")
    private String contentBase64;

    @Column(name = "content_hash", length = 64)
    private String contentHash;

    @Column(name = "command_key", nullable = false, length = 80)
    private String commandKey;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
