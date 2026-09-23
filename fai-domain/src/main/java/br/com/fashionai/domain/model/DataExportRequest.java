package br.com.fashionai.domain.model;

import br.com.fashionai.domain.model.enums.ExportStatus;
import jakarta.persistence.Column;
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

/** RF3.CA22-CA23 — exportação dos dados do titular em JSON (Art. 18, V — portabilidade). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "data_export_requests")
public class DataExportRequest extends VersionedAuditableEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExportStatus status = ExportStatus.REQUESTED;

    @Column(name = "file_key", length = 512)
    private String fileKey;

    @Column(name = "ready_at")
    private Instant readyAt;

    @Column(name = "expires_at")
    private Instant expiresAt;
}
