package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.ShoppingPlanDismissal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShoppingPlanDismissalRepository extends JpaRepository<ShoppingPlanDismissal, UUID> {
    List<ShoppingPlanDismissal> findByUserId(UUID userId);

    Optional<ShoppingPlanDismissal> findByUserIdAndProductId(UUID userId, UUID productId);
}
