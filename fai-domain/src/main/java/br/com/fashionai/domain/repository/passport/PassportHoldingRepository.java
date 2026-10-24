package br.com.fashionai.domain.repository.passport;

import br.com.fashionai.domain.model.passport.PassportHolding;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;

public interface PassportHoldingRepository extends JpaRepository<PassportHolding, UUID> {
    List<PassportHolding> findByOwnerId(UUID ownerId);
    Optional<PassportHolding> findByActivePassportId(UUID passportId);
    List<PassportHolding> findByPassportIdOrderByStartedAtAsc(UUID passportId);
}
