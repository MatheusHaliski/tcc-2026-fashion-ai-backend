package br.com.fashionai.domain.repository.passport;

import br.com.fashionai.domain.model.passport.PassportShare;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;

public interface PassportShareRepository extends JpaRepository<PassportShare, UUID> {
    List<PassportShare> findByOwnerId(UUID ownerId);
    Optional<PassportShare> findByTokenHash(String hash);
    List<PassportShare> findByPassportId(UUID passportId);
}
