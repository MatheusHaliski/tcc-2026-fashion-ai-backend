package br.com.fashionai.application.view;

import br.com.fashionai.domain.model.PieceCommerceAttributes;
import br.com.fashionai.domain.model.WardrobeItem;

import java.time.Instant;
import java.util.UUID;

public record PieceCommerceView(Instant expiresAt, UUID negotiationId, Instant negotiationStartedAt,
                                 long tryOnCount, long viewCount, Long salesCount, String negotiationPartnerUsername) {
    public static PieceCommerceView from(PieceCommerceAttributes piece) {
        String partner = piece instanceof WardrobeItem item && item.getNegotiationPartner() != null
                ? item.getNegotiationPartner().getUsername() : null;
        return new PieceCommerceView(piece.getExpiresAt(), piece.getNegotiationId(),
                piece.getNegotiationStartedAt(), piece.getTryOnCount(), piece.getViewCount(), piece.getSalesCount(), partner);
    }
}
