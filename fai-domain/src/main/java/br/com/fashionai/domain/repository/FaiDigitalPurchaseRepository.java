package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FaiDigitalPurchase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FaiDigitalPurchaseRepository extends JpaRepository<FaiDigitalPurchase, UUID> {
    Optional<FaiDigitalPurchase> findByOwnerIdAndOffer_Code(UUID ownerId, String code);

    List<FaiDigitalPurchase> findByOwnerIdOrderByPurchasedAtDesc(UUID ownerId);

    boolean existsByOffer_Code(String code);
}
