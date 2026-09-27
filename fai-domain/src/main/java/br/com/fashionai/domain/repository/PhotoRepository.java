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

/** Repositório Spring Data de Photo (MySQL — fonte da verdade). */
public interface PhotoRepository extends JpaRepository<Photo, UUID> {
    List<Photo> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    Page<Photo> findByUserIdAndDeletedAtIsNull(UUID userId, Pageable pageable);

    long countByUserIdAndDeletedAtIsNull(UUID userId);

    /** RF12.CA01/CA06 — filtro por origem feito no banco (usa idx_photos_user_origin_created), não depois da página. */
    Page<Photo> findByUserIdAndOriginAndDeletedAtIsNull(UUID userId, PhotoOrigin origin, Pageable pageable);

    /** RF12.CA01 — contagem por origem para os filtros da galeria (consulta agrupada). */
    @Query("select p.origin, count(p) from Photo p where p.user.id = :userId and p.deletedAt is null group by p.origin")
    List<Object[]> countByOrigin(@Param("userId") UUID userId);

    List<Photo> findByUserIdAndKeyMomentTrueAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    List<Photo> findByUserIdAndSourceEntityId(UUID userId, UUID sourceEntityId);

    List<Photo> findByUserIdAndSourceEntityIdAndDeletedAtIsNull(UUID userId, UUID sourceEntityId);

    List<Photo> findByUserIdAndPublicUrlAndDeletedAtIsNull(UUID userId, String publicUrl);

    List<Photo> findByIdInAndUserId(Collection<UUID> ids, UUID userId);
}
