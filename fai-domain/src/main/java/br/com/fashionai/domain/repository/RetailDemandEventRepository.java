package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.RetailDemandEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RetailDemandEventRepository extends JpaRepository<RetailDemandEvent, UUID> {
    List<RetailDemandEvent> findByBrandIdAndBucketDayBetween(UUID brandId, LocalDate from, LocalDate to);

    Optional<RetailDemandEvent> findByContributorHashAndProductIdAndKindAndBucketDay(String contributorHash, UUID productId, String kind, LocalDate bucketDay);

    List<RetailDemandEvent> findByContributorHash(String contributorHash);

    long countByContributorHash(String contributorHash);
}
