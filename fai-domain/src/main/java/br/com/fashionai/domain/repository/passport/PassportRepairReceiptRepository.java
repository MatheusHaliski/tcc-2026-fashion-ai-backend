package br.com.fashionai.domain.repository.passport;

import br.com.fashionai.domain.model.passport.PassportRepairReceipt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PassportRepairReceiptRepository extends JpaRepository<PassportRepairReceipt, UUID> {
    List<PassportRepairReceipt> findByOrderIdOrderByCreatedAtAsc(UUID orderId);

    Optional<PassportRepairReceipt> findByOrderIdAndProviderIdAndCommandKey(UUID orderId, UUID providerId, String commandKey);

    List<PassportRepairReceipt> findByProviderId(UUID providerId);
}
