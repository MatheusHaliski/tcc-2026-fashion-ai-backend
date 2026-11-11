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
 * FLAIR 3D MAKE UP (V99) — um look entregue num brief: pontos, estrelas e o Prestígio que ele rendeu (só as estrelas
 * novas no brief contam). A carreira é a soma de {@code prestigio} da pessoa.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "flair_makeup_looks")
public class FlairMakeUpLook {
    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    /** Código do brief (ENSAIO_VERAO, ENTREVISTA...). */
    @Column(nullable = false, length = 32)
    private String brief;

    /** O que foi entregue: cartas por vaga e maquiagem por área. */
    @Column(name = "look_json", columnDefinition = "json")
    private String lookJson;

    @Column(nullable = false)
    private int pontos;

    @Column(nullable = false)
    private int estrelas;

    @Column(nullable = false)
    private int prestigio;

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
