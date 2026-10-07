package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * RF19.CA13 · Uma fonte de um look remixado (V46): a peça ou o look de origem, na ordem da seleção. Guarda só ids — o
 * crédito "Remix de @a, @b" é montado na leitura, respeitando a visibilidade da fonte para quem vê o look.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "scheme_remix_sources")
public class SchemeRemixSource {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, length = 36)
    private UUID id;

    @Column(name = "scheme_id", nullable = false, length = 36)
    private UUID schemeId;

    @Column(nullable = false)
    private int position;

    /** PIECE · SCHEME */
    @Column(name = "source_type", nullable = false, length = 10)
    private String sourceType;

    @Column(name = "source_piece_id", length = 36)
    private UUID sourcePieceId;

    @Column(name = "source_scheme_id", length = 36)
    private UUID sourceSchemeId;

    @Column(name = "source_owner_id", length = 36)
    private UUID sourceOwnerId;

    /** Peça própria usada no lugar da peça alheia (correspondência por semelhança); null quando a fonte já é própria. */
    @Column(name = "mapped_piece_id", length = 36)
    private UUID mappedPieceId;

    /** Por onde o remix começou: PIECE · TOP_BAR · TRAY · LOOK · LENS · PHOTO */
    @Column(length = 12)
    private String channel;

    @Column(name = "notified_at")
    private Instant notifiedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
