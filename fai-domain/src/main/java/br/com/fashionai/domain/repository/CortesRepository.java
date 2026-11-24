package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.Cortes;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CortesRepository extends JpaRepository<Cortes, UUID> {
    List<Cortes> findAllByOrderByNomeAsc();
}
