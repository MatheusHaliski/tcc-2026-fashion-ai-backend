package br.com.fashionai.domain.repository.passport;

import br.com.fashionai.domain.model.passport.PassportRepairOrderEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PassportRepairOrderEventRepository extends JpaRepository<PassportRepairOrderEvent, UUID> {
    List<PassportRepairOrderEvent> findByOrderIdOrderByCreatedAtAsc(UUID orderId);
}
