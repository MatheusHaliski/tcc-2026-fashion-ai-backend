package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** RF53 · P1-10 — marcos de Hype já alcançados (dedupe por entidade + marco e resumo diário por dono). */
public interface HypeMilestoneRepository extends JpaRepository<HypeMilestone, UUID> {
    List<HypeMilestone> findByEntityTypeAndEntityId(HypeEntityType entityType, UUID entityId);

    /** Marcos do dono num dia: formam o resumo único daquele dia. */
    List<HypeMilestone> findByOwnerIdAndDigestDateOrderByAchievedAtAsc(UUID ownerId, LocalDate digestDate);

    /** Exportação LGPD: todos os marcos do dono, do mais recente ao mais antigo. */
    List<HypeMilestone> findByOwnerIdOrderByAchievedAtDesc(UUID ownerId);

    /** Exclusão da conta (anonimização): os marcos saem junto. */
    long deleteByOwnerId(UUID ownerId);
}
