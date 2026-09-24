package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de Reaction (MySQL — fonte da verdade). */
public interface ReactionRepository extends JpaRepository<Reaction, UUID> {
    Optional<Reaction> findByActorIdAndTargetTypeAndTargetIdAndReactionType(UUID actorId, TargetType targetType, UUID targetId, ReactionType type);

    long countByTargetTypeAndTargetIdAndReactionType(TargetType targetType, UUID targetId, ReactionType type);

    List<Reaction> findByActorIdAndTargetTypeAndTargetId(UUID actorId, TargetType targetType, UUID targetId);

    List<Reaction> findByActorIdAndReactionType(UUID actorId, ReactionType type);

    long countByActorIdAndReactionType(UUID actorId, ReactionType type);

    long countByActorIdAndCreatedAtAfter(UUID actorId, Instant since);

    @Query("select r.targetId, count(r) from Reaction r where r.targetType = :type and r.reactionType = br.com.fashionai.domain.model.enums.ReactionType.LIKE and r.createdAt >= :since group by r.targetId") List<Object[]> countLikesSince(@Param("type") TargetType type, @Param("since") Instant since);
}
