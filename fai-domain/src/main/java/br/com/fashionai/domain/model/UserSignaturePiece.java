package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Exercício 18 — Peça Assinatura do perfil (tabela user_signature_pieces): a peça do próprio guarda-roupa que a pessoa
 * escolhe para representá-la. Uma por pessoa (a chave é o usuário). No banco, a FK composta
 * {@code (user_id, piece_id) → wardrobe_items (user_id, id)} só aceita peça do mesmo dono. Não é a assinatura de marca
 * nem o estilo de celebridade.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_signature_pieces")
public class UserSignaturePiece {
    @Id
    @Column(name = "user_id", nullable = false, updatable = false, length = 36)
    private UUID userId;

    @Column(name = "piece_id", nullable = false, length = 36)
    private UUID pieceId;

    /** Revisão da escolha: quem grava informa a que leu e uma gravação concorrente é recusada em vez de sobrescrita. */
    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
