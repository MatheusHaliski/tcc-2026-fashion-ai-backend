package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.TipoLavagem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TipoLavagemRepository extends JpaRepository<TipoLavagem, UUID> {
    List<TipoLavagem> findAllByOrderByNomeAsc();
}
