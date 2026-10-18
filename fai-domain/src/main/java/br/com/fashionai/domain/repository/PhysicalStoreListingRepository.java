package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.PhysicalStoreListing;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PhysicalStoreListingRepository extends JpaRepository<PhysicalStoreListing, UUID> {
    List<PhysicalStoreListing> findBySellerUserIdOrderByCreatedAtDesc(UUID sellerUserId);
    List<PhysicalStoreListing> findByActiveTrueOrderByCreatedAtDesc();
    List<PhysicalStoreListing> findAllByOrderByCreatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from PhysicalStoreListing l where l.id = :id")
    Optional<PhysicalStoreListing> lockById(@Param("id") UUID id);
}
