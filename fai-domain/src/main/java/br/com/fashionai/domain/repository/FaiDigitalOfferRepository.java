package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.FaiDigitalOffer;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

public interface FaiDigitalOfferRepository extends JpaRepository<FaiDigitalOffer, String> {
    List<FaiDigitalOffer> findByActiveTrueAndKindOrderByPointsAsc(String kind);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<FaiDigitalOffer> findByCode(String code);
}
