package br.com.fashionai.domain.repository.passport;

import br.com.fashionai.domain.model.passport.GarmentPassport;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;

public interface GarmentPassportRepository extends JpaRepository<GarmentPassport, UUID> {
    List<GarmentPassport> findByOwnerId(UUID ownerId);
    Optional<GarmentPassport> findByPieceId(UUID pieceId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from GarmentPassport p where p.id = :id")
    Optional<GarmentPassport> lockById(@Param("id") UUID id);
}
