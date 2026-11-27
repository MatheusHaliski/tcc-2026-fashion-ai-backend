package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Exercício 18 — histórico da Peça Assinatura (tabela signature_piece_history): uma linha por mudança efetiva. Escolha:
 * a peça e um retrato mínimo dela ({@code snapshotJson}: nome, categoria, subcategoria, cor e marca — nunca notas, local
 * de compra ou fotos). Remoção da escolha: peça e retrato nulos. Se a peça for apagada do banco, a FK zera
 * {@code pieceId} e o retrato continua contando o que foi escolhido.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "signature_piece_history")
public class SignaturePieceHistory {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false, length = 36)
    private UUID userId;

    @Column(name = "piece_id", length = 36)
    private UUID pieceId;

    @Column(name = "snapshot_json", columnDefinition = "json")
    private String snapshotJson;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
