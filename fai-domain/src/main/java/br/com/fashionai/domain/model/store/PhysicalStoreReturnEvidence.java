package br.com.fashionai.domain.model.store;

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

/** Comprovante (foto PNG re-codificada) de um caso de devolução; cifrado em repouso e nunca servido como mídia pública. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "physical_store_return_evidence", uniqueConstraints = @UniqueConstraint(name = "uq_return_evidence_command", columnNames = {"case_id", "uploader_id", "command_key"}))
public class PhysicalStoreReturnEvidence extends VersionedAuditableEntity {
    @Column(name = "case_id", nullable = false, length = 36)
    private UUID caseId;

    @Column(name = "uploader_id", nullable = false, length = 36)
    private UUID uploaderId;

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
