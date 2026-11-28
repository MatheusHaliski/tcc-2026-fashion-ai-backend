package br.com.fashionai.application.marketplace;

import br.com.fashionai.domain.model.MarketplaceNegotiation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record NegotiationView(UUID id, UUID pieceId, UUID storeId, UUID ownerId, UUID counterpartyId,
                              UUID proposedBy, long version, BigDecimal amount, String currency,
                              String terms, Instant expiresAt, String status) {
    static NegotiationView from(MarketplaceNegotiation offer, Instant now) {
        boolean expired = ("PENDING".equals(offer.getStatus()) || "ACCEPTED".equals(offer.getStatus())) && !offer.getExpiresAt().isAfter(now);
        return new NegotiationView(offer.getId(), offer.getPieceId(), offer.getStoreId(), offer.getOwnerUserId(),
                offer.getCounterpartyUserId(), offer.getProposedBy(), offer.getVersion(), offer.getAmount(),
                offer.getCurrency(), offer.getTerms(), offer.getExpiresAt(), expired ? "EXPIRED" : offer.getStatus());
    }
}
