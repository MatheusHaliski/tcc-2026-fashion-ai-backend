package br.com.fashionai.domain.repository.passport;

import br.com.fashionai.domain.model.passport.PassportEvent;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;

public interface PassportEventRepository extends JpaRepository<PassportEvent, UUID> {
    List<PassportEvent> findByAuthorId(UUID authorId);
    List<PassportEvent> findByPassportIdOrderByCreatedAtAsc(UUID passportId);
    Optional<PassportEvent> findByPassportIdAndAuthorIdAndCommandKey(UUID passportId, UUID authorId, String commandKey);
}
