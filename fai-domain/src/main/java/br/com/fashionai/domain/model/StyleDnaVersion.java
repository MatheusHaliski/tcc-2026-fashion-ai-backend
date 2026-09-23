package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** HU20 — versionamento do DNA por data de geração (sem a Camada 2, que fica só cifrada em style_dna). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "style_dna_versions")
public class StyleDnaVersion {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "snapshot_json", nullable = false, columnDefinition = "json")
    private String snapshotJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
