package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.Origem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OrigemRepository extends JpaRepository<Origem, UUID> {
    List<Origem> findAllByOrderByCodigoAsc();
}