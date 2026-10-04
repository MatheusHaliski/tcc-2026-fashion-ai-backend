package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** HypeScore v2 — série histórica diária (por versão do algoritmo). */
public interface HypeScoreSnapshotRepository extends JpaRepository<HypeScoreSnapshot, UUID> {
    List<HypeScoreSnapshot> findByEntityTypeAndEntityIdAndAlgorithmVersionAndSnapshotDateGreaterThanEqualOrderBySnapshotDateAsc(
            HypeEntityType entityType, UUID entityId, String algorithmVersion, LocalDate since);

    List<HypeScoreSnapshot> findByEntityTypeAndEntityIdInAndAlgorithmVersionAndSnapshotDateGreaterThanEqual(
            HypeEntityType entityType, Collection<UUID> ids, String algorithmVersion, LocalDate since);

    /** Base do delta: snapshots de todas as entidades do tipo num intervalo de datas (uma consulta por execução do job). */
    List<HypeScoreSnapshot> findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(HypeEntityType entityType, String algorithmVersion,
                                                                                       LocalDate from, LocalDate to);

    Optional<HypeScoreSnapshot> findByEntityTypeAndEntityIdAndAlgorithmVersionAndSnapshotDate(HypeEntityType entityType, UUID entityId,
                                                                                              String algorithmVersion, LocalDate date);
}
