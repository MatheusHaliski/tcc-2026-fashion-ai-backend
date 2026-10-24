package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.EstadoConservacao;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EstadoConservacaoRepository extends JpaRepository<EstadoConservacao, UUID> {
    List<EstadoConservacao> findAllByOrderByNomeAsc();
}
