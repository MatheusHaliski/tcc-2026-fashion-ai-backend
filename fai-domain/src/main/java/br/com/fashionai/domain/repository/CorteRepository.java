package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.Corte;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CorteRepository extends JpaRepository<Corte, UUID> {
    List<Corte> findAllByAtivoTrueOrderByNomeAsc();
}
