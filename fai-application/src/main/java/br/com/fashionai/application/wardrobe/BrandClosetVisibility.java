package br.com.fashionai.application.wardrobe;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;

import java.time.Instant;

public final class BrandClosetVisibility {
    private BrandClosetVisibility() {}

    public static boolean onlyInCloset(WardrobeItem piece) {
        boolean brandPiece = piece.getUser().getProfileType() == ProfileType.MARCA;
        boolean expired = piece.getExpiresAt() != null && !piece.getExpiresAt().isAfter(Instant.now());
        return brandPiece && !piece.isForSale() || expired && (brandPiece || piece.getNegotiationId() != null);
    }

    public static Visibility effective(WardrobeItem piece, Visibility visibility) {
        return onlyInCloset(piece) ? Visibility.PRIVATE : visibility;
    }
}
