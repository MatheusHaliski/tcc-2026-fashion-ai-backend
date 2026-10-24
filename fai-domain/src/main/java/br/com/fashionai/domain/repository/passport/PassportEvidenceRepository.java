package br.com.fashionai.domain.repository.passport;

import br.com.fashionai.domain.model.passport.PassportEvidence;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;

public interface PassportEvidenceRepository extends JpaRepository<PassportEvidence, UUID> {
    List<PassportEvidence> findByControllerId(UUID controllerId);
    List<PassportEvidence> findByPassportIdAndControllerId(UUID passportId, UUID controllerId);
    Optional<PassportEvidence> findByPassportIdAndControllerIdAndCommandKey(UUID passportId, UUID controllerId, String commandKey);
    List<PassportEvidence> findByExpiresAtBeforeAndDeletedAtIsNull(Instant before);
}
