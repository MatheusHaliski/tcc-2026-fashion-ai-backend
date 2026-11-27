package br.com.fashionai.domain.repository.passport;

import br.com.fashionai.domain.model.passport.PassportRepairOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PassportRepairOrderRepository extends JpaRepository<PassportRepairOrder, UUID> {
    Optional<PassportRepairOrder> findByPassportIdAndOwnerIdAndCommandKey(UUID passportId, UUID ownerId, String commandKey);

    List<PassportRepairOrder> findByPassportIdOrderByCreatedAtDesc(UUID passportId);

    List<PassportRepairOrder> findByProviderIdOrderByCreatedAtDesc(UUID providerId);

    List<PassportRepairOrder> findByOwnerId(UUID ownerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from PassportRepairOrder o where o.id = :id")
    Optional<PassportRepairOrder> lockById(@Param("id") UUID id);
}
