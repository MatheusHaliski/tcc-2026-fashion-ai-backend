package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.CbcPreference;
import br.com.fashionai.domain.model.CbcPreferenceId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Exercício 16 — cenário preferido de cada pessoa em cada Desafio de Montagem (tabela cbc_preferences). */
public interface CbcPreferenceRepository extends JpaRepository<CbcPreference, CbcPreferenceId> {
    List<CbcPreference> findByIdUserId(UUID userId);
}
