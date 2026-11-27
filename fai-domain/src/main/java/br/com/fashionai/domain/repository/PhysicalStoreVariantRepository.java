package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.PhysicalStoreVariant;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PhysicalStoreVariantRepository extends JpaRepository<PhysicalStoreVariant, UUID> {
    List<PhysicalStoreVariant> findByListingIdOrderByVariantKeyAsc(UUID listingId);

    List<PhysicalStoreVariant> findByListingIdIn(Collection<UUID> listingIds);

    Optional<PhysicalStoreVariant> findByListingIdAndVariantKey(UUID listingId, String variantKey);

    long countByListingIdAndActiveTrue(UUID listingId);

    /** Trava a variante escolhida até o fim da transação: duas compras do último SKU só debitam uma vez. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from PhysicalStoreVariant v where v.id = :id")
    Optional<PhysicalStoreVariant> lockById(@Param("id") UUID id);
}
