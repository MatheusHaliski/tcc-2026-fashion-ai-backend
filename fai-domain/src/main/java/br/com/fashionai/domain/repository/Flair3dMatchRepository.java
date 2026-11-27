package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.Flair3dMatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface Flair3dMatchRepository extends JpaRepository<Flair3dMatch, UUID> {
    List<Flair3dMatch> findByUserIdAndNucleo(UUID userId, String nucleo);

    /** Quem jogou desde a data ("ativos recentemente" na busca de adversários). */
    List<Flair3dMatch> findByUserIdInAndUpdatedAtAfter(Collection<UUID> userIds, Instant desde);
}
