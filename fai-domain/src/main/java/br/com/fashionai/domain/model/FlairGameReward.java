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
 * Glass Empire (V86) — recompensa extra de um jogo FLAIR entregue a uma pessoa: um Item do quarto ou uma carta
 * Especial. Uma linha por (pessoa, jogo, código): é ela que torna a entrega idempotente e serve de origem
 * ({@code originId}) da carta Especial criada.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_game_rewards")
public class FlairGameReward {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "challenge_id", nullable = false, length = 36)
    private UUID challengeId;

    @Column(name = "submission_id", length = 36)
    private UUID submissionId;

    /** ITEM ou SPECIAL_CARD. */
    @Column(nullable = false, length = 16)
    private String type;

    /** Código da recompensa (sku do Item ou código da carta), único por pessoa e jogo. */
    @Column(nullable = false, length = 60)
    private String code;

    /** DELIVERED, ou PENDING quando o sku ainda não existe no catálogo. */
    @Column(nullable = false, length = 16)
    private String state = "DELIVERED";

    /** O que foi criado: id do item do inventário ou da carta Especial. */
    @Column(name = "ref_id", length = 36)
    private UUID refId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
