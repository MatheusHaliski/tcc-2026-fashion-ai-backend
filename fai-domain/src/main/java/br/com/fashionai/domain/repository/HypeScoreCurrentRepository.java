package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** HypeScore v2 — estado atual por entidade e versão do algoritmo. */
public interface HypeScoreCurrentRepository extends JpaRepository<HypeScoreCurrent, UUID> {
    List<HypeScoreCurrent> findByEntityTypeAndAlgorithmVersion(HypeEntityType entityType, String algorithmVersion);

    List<HypeScoreCurrent> findByEntityTypeAndEntityIdInAndAlgorithmVersion(HypeEntityType entityType, Collection<UUID> ids, String algorithmVersion);

    Optional<HypeScoreCurrent> findByEntityTypeAndEntityIdAndAlgorithmVersion(HypeEntityType entityType, UUID entityId, String algorithmVersion);

    List<HypeScoreCurrent> findByOwnerIdAndEntityTypeAndAlgorithmVersion(UUID ownerId, HypeEntityType entityType, String algorithmVersion);

    /** População do ranking: só públicas e com score disponível (privacidade e "sem dados" ficam de fora). */
    List<HypeScoreCurrent> findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType entityType, String algorithmVersion, HypeStatus status);
}
