package br.com.fashionai.domain.model;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Exercício 16 — cenário permitido num Desafio de Montagem (tabela cbc_challenge_scenarios). A preferência da pessoa
 * (cbc_preferences) tem FK composta para cá: no banco, só se prefere um cenário permitido naquele desafio.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "cbc_challenge_scenarios")
public class CbcChallengeScenario {
    @EmbeddedId
    private CbcChallengeScenarioId id;
}
