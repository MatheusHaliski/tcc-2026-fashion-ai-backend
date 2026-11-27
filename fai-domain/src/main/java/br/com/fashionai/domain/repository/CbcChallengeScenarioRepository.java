package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.CbcChallengeScenario;
import br.com.fashionai.domain.model.CbcChallengeScenarioId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Exercício 16 — cenários permitidos em cada Desafio de Montagem (tabela cbc_challenge_scenarios). */
public interface CbcChallengeScenarioRepository extends JpaRepository<CbcChallengeScenario, CbcChallengeScenarioId> {
    List<CbcChallengeScenario> findByIdChallengeId(UUID challengeId);
}
