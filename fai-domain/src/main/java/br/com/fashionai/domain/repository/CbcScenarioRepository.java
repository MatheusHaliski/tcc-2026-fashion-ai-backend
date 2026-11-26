package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.CbcScenario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/** Exercício 16 — opções de cenário dos Desafios de Montagem (tabela cbc_scenarios). */
public interface CbcScenarioRepository extends JpaRepository<CbcScenario, UUID> {
    Optional<CbcScenario> findByCodigo(String codigo);
}
