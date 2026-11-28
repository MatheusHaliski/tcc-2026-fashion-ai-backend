package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.MarketplaceNegotiation;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MarketplaceNegotiationRepository extends JpaRepository<MarketplaceNegotiation, UUID> {
    List<MarketplaceNegotiation> findByOwnerUserIdOrCounterpartyUserIdOrderByUpdatedAtDesc(
            UUID owner, UUID counterparty, Pageable page);

    Optional<MarketplaceNegotiation> findByPieceIdAndStoreIdAndCounterpartyUserId(UUID piece, UUID store, UUID counterparty);
}
