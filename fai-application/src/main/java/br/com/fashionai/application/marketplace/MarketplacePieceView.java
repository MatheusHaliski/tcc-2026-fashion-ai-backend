package br.com.fashionai.application.marketplace;

import br.com.fashionai.domain.model.WardrobeItem;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MarketplacePieceView(UUID id, String name, String imageUrl, String status, BigDecimal price, Instant expiresAt, boolean forSale) {
    static MarketplacePieceView from(WardrobeItem piece) {
        String canonical = piece.getCanonicalImageUrl();
        return new MarketplacePieceView(piece.getId(), piece.getName(),
                canonical == null ? piece.getImageUrl() : canonical, piece.getAuraMetamorphoseStatus(), piece.getPrice(), piece.getExpiresAt(), piece.isForSale());
    }
}
