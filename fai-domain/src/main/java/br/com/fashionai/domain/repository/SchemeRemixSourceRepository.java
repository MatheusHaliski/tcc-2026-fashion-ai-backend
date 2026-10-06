package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.SchemeRemixSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Repositório Spring Data das fontes de um look remixado (V46). */
public interface SchemeRemixSourceRepository extends JpaRepository<SchemeRemixSource, UUID> {
    List<SchemeRemixSource> findBySchemeIdOrderByPositionAsc(UUID schemeId);

    List<SchemeRemixSource> findBySchemeIdInOrderByPositionAsc(Collection<UUID> schemeIds);

    long countBySourcePieceId(UUID pieceId);

    long countBySourceSchemeId(UUID schemeId);
}
