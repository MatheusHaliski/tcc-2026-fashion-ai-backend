package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FlairCardInstance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FlairCardInstanceRepository extends JpaRepository<FlairCardInstance, UUID> {
    List<FlairCardInstance> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);

    /** As cartas de uma página de pessoas ("tem deck para este jogo" na busca de adversários). */
    List<FlairCardInstance> findByOwnerIdIn(Collection<UUID> ownerIds);

    /** D6 — a carta da peça (ou do look) na temporada. */
    Optional<FlairCardInstance> findByOriginTypeAndOriginIdAndSeason(String originType, UUID originId, String season);

    List<FlairCardInstance> findByOriginTypeAndOriginIdOrderByCreatedAtDesc(String originType, UUID originId);
}
