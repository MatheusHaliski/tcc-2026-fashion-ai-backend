package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * FLAIR 3D (V99) — partida de um dos 15 núcleos (docs/flair/flair-3d/BASE_NUCLEOS.md): a pessoa abre com o deck, o
 * servidor sorteia a semente, e a entrega (uma só) grava o que foi entregue e o resultado calculado pelo núcleo.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair3d_matches")
public class Flair3dMatch {
    public static final String ABERTA = "ABERTA";
    public static final String ENTREGUE = "ENTREGUE";

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    /** Código do núcleo (PASSARELA, DRESS_FIGHTER...). */
    @Column(nullable = false, length = 32)
    private String nucleo;

    /** ABERTA ou ENTREGUE. */
    @Column(nullable = false, length = 16)
    private String status = ABERTA;

    /** Semente do sorteio da partida: o resultado é determinístico a partir dela. */
    @Column(nullable = false)
    private long semente;

    /** Ids das cartas levadas para a partida (nulo nos núcleos sem deck). */
    @Column(name = "deck_json", columnDefinition = "json")
    private String deckJson;

    @Column(name = "entrega_json", columnDefinition = "json")
    private String entregaJson;

    @Column(name = "resultado_json", columnDefinition = "json")
    private String resultadoJson;

    private Integer pontos;

    private Integer estrelas;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
