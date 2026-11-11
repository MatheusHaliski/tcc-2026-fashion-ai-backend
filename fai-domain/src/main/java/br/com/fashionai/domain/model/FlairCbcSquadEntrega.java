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
 * FLAIR Card Building Challenge (V99) — entrega de um dos cinco elencos: as cartas por vaga, a química e a edição (ordem
 * de conclusão daquele elenco; repetir mantém a edição da primeira conclusão da pessoa).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_cbc_squad_entregas")
public class FlairCbcSquadEntrega {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    /** Código do elenco (PRIMEIRO_ELENCO, PALETA_ATELIE...). */
    @Column(nullable = false, length = 32)
    private String elenco;

    /** {vaga: cardId}. */
    @Column(name = "cartas_json", nullable = false, columnDefinition = "json")
    private String cartasJson;

    @Column(nullable = false)
    private int quimica;

    @Column(nullable = false)
    private boolean ok;

    private Integer edicao;

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
