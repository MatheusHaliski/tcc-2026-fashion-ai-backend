package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Personalização visual (cores, materiais, transformações) de uma peça, por pessoa; o modelo original fica intacto. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "piece_3d_customizations", uniqueConstraints = @UniqueConstraint(name = "uq_piece_customization", columnNames = {"piece_id", "owner_id"}))
public class Piece3dCustomization extends VersionedAuditableEntity {
    @Column(name = "piece_id", nullable = false, length = 36)
    private UUID pieceId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private UUID ownerId;

    /** URL do GLB original no momento da personalização; se mudar, a personalização é marcada como de outra base. */
    @Column(name = "base_model_url", nullable = false, length = 1024)
    private String baseModelUrl;

    @Lob
    @Column(name = "document_json", nullable = false, columnDefinition = "LONGTEXT")
    private String documentJson;

    @Column(nullable = false)
    private long revision;

    @Column(name = "request_id", nullable = false, length = 80)
    private String requestId;
}
