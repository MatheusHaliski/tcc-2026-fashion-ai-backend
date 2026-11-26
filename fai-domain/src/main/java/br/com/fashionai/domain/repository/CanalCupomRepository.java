package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.CanalCupom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * Exercício 14 — canais de utilização do cupom (tabela canais_cupom). A escolha lista só os ativos; findById (herdado)
 * acha também o inativo, para a oferta antiga continuar lendo o canal dela e o serviço recusar um canal inativo novo.
 */
public interface CanalCupomRepository extends JpaRepository<CanalCupom, UUID> {
    List<CanalCupom> findAllByAtivoTrueOrderByNomeAsc();
}
