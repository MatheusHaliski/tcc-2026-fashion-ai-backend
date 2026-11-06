package br.com.fashionai.domain.repository.fitting;

import br.com.fashionai.domain.model.fitting.FittingAppointmentItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FittingAppointmentItemRepository extends JpaRepository<FittingAppointmentItem, UUID> {
    List<FittingAppointmentItem> findByAppointmentIdOrderByCreatedAtAsc(UUID appointmentId);
}
