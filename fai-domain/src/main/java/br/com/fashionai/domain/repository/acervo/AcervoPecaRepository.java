package br.com.fashionai.domain.repository.acervo;

import br.com.fashionai.domain.model.acervo.AcervoPeca;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AcervoPecaRepository extends JpaRepository<AcervoPeca, UUID> {
    List<AcervoPeca> findByUserId(UUID userId);

    Optional<AcervoPeca> findByPieceId(UUID pieceId);

    List<AcervoPeca> findByCompartimentoIdIn(Collection<UUID> compartimentoIds);
}
