package br.com.fashionai.domain.repository.fitting;

import br.com.fashionai.domain.model.fitting.FittingAppointment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FittingAppointmentRepository extends JpaRepository<FittingAppointment, UUID> {
    Optional<FittingAppointment> findByUserIdAndRequestId(UUID userId, String requestId);

    List<FittingAppointment> findByUserIdOrderByRequestedSlotDesc(UUID userId);

    List<FittingAppointment> findBySellerIdOrderByRequestedSlotDesc(UUID sellerId);

    List<FittingAppointment> findByStatusAndExpiresAtBefore(String status, Instant before);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from FittingAppointment a where a.id = :id")
    Optional<FittingAppointment> lockById(@Param("id") UUID id);
}
