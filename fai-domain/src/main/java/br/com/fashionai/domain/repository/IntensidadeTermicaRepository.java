package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.IntensidadeTermica;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface IntensidadeTermicaRepository extends JpaRepository<IntensidadeTermica, UUID> {
    List<IntensidadeTermica> findAllByOrderByNomeAsc();
}
