package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Exercício 16 — cenário que a pessoa prefere ver num Desafio de Montagem (tabela cbc_preferences). É só dela: não muda
 * o cenário oficial do desafio ({@code flair_challenges.scenario}), nem requisitos, pontos, vagas ou entregas.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "cbc_preferences")
public class CbcPreference {
    @EmbeddedId
    private CbcPreferenceId id;

    @Column(name = "scenario_id", nullable = false, length = 36)
    private UUID scenarioId;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
