package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FlairCbcSquadEntrega;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FlairCbcSquadEntregaRepository extends JpaRepository<FlairCbcSquadEntrega, UUID> {
    List<FlairCbcSquadEntrega> findByUserId(UUID userId);

    Optional<FlairCbcSquadEntrega> findFirstByUserIdAndElencoAndOkTrueOrderByCreatedAtAsc(UUID userId, String elenco);

    /** A maior edição já dada no elenco (a próxima conclusão leva a seguinte). */
    Optional<FlairCbcSquadEntrega> findFirstByElencoAndOkTrueOrderByEdicaoDesc(String elenco);
}
