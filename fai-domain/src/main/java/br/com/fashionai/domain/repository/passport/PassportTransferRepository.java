package br.com.fashionai.domain.repository.passport;

import br.com.fashionai.domain.model.passport.PassportTransfer;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;

public interface PassportTransferRepository extends JpaRepository<PassportTransfer, UUID> {
    List<PassportTransfer> findByFromOwnerIdOrRecipientId(UUID fromOwnerId, UUID recipientId);
    @Query("select t.passportId from PassportTransfer t where t.id = :id")
    Optional<UUID> passportIdOf(@Param("id") UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from PassportTransfer t where t.id = :id")
    Optional<PassportTransfer> lockById(@Param("id") UUID id);
    List<PassportTransfer> findByPassportIdOrderByCreatedAtDesc(UUID passportId);
    List<PassportTransfer> findByRecipientIdAndStatusOrderByCreatedAtDesc(UUID recipientId, String status);
    Optional<PassportTransfer> findByPassportIdAndFromOwnerIdAndCommandKey(UUID passportId, UUID ownerId, String key);
}
