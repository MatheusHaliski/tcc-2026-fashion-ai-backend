package br.com.fashionai.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

/** Exercício 16 — chave de cbc_challenge_scenarios: o desafio e um cenário que ele permite. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
@Embeddable
public class CbcChallengeScenarioId implements Serializable {
    @Column(name = "challenge_id", nullable = false, length = 36)
    private UUID challengeId;

    @Column(name = "scenario_id", nullable = false, length = 36)
    private UUID scenarioId;
}
