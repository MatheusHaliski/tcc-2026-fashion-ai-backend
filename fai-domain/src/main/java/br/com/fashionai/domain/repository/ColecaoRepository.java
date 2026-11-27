package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.Colecao;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ColecaoRepository extends JpaRepository<Colecao, UUID> {
    List<Colecao> findAllByOrderByNomeAsc();
}
