package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.TipoLook;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface TipoLookRepository extends JpaRepository<TipoLook, UUID> {
    List<TipoLook> findAllByOrderByNomeAsc();
}
