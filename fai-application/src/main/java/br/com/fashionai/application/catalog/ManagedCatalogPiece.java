package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.view.PieceCommerceView;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogSaleStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

final class ManagedCatalogPiece {
    private ManagedCatalogPiece() {}

    static boolean visible(CatalogProduct product, Brand brand) {
        if (product.getSourceType() != CatalogSourceType.VERIFIED_BRAND_PROFILE) return true;
        var piece = product.getManagedPiece();
        var profile = brand == null ? null : brand.getBrandProfile();
        if (piece == null || profile == null || profile.getApprovalStatus() != ApprovalStatus.APROVADO) return false;
        var owner = piece.getUser();
        return owner.getId().equals(profile.getOwner().getId()) && owner.getProfileType() == ProfileType.MARCA
                && owner.getStatus() == AccountStatus.ACTIVE && owner.isVerified() && piece.isForSale() && piece.getVisibility() == Visibility.PUBLIC
                && piece.getModerationStatus() == ModerationStatus.APPROVED && piece.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED
                && (piece.getExpiresAt() == null || piece.getExpiresAt().isAfter(Instant.now()));
    }

    static Map<String, Object> image(CatalogProduct product, Brand brand, Map<String, Object> fallback) {
        if (product.getSourceType() != CatalogSourceType.VERIFIED_BRAND_PROFILE || !visible(product, brand)) return fallback;
        var piece = product.getManagedPiece();
        if (piece.isDefaultImage()) return fallback;
        Object inherited = Json.map(piece.getFlatLayMetadataJson()).get("catalogImage");
        if (inherited instanceof Map<?, ?> original && Objects.equals(original.get("url"), piece.getImageUrl())) {
            Map<String, Object> copy = new LinkedHashMap<>();
            original.forEach((key, value) -> copy.put(String.valueOf(key), value));
            return copy;
        }
        String url = piece.getCanonicalImageUrl() == null ? piece.getImageUrl() : piece.getCanonicalImageUrl();
        if (url == null || url.isBlank()) return fallback;
        Map<String, Object> frame = Map.of("url", url, "box", Map.of("x", 0, "y", 0, "w", 1, "h", 1),
                "rendered", true, "processed", true);
        return new LinkedHashMap<>(Map.of("url", url, "mode", "PROCESSED", "aspect", "3:4", "whole", frame));
    }

    static CatalogSaleStatus saleStatus(CatalogProduct product) {
        if (product.getSourceType() == CatalogSourceType.VERIFIED_BRAND_PROFILE) {
            var piece = product.getManagedPiece();
            return piece != null && piece.isForSale()
                    && (piece.getExpiresAt() == null || piece.getExpiresAt().isAfter(Instant.now()))
                    ? CatalogSaleStatus.AVAILABLE : CatalogSaleStatus.EXPIRED;
        }
        if (product.getSourceStatus() == CatalogSourceStatus.UNAVAILABLE
                || product.getSourceStatus() == CatalogSourceStatus.SOURCE_REMOVED
                || product.getIngestionStatus() == CatalogIngestionStatus.REJECTED) {
            return CatalogSaleStatus.EXPIRED;
        }
        return product.getStatus();
    }

    static PieceCommerceView commerce(CatalogProduct product, Brand brand) {
        return PieceCommerceView.from(product.getManagedPiece() != null && visible(product, brand)
                ? product.getManagedPiece() : product);
    }

    static void decorate(Map<String, Object> card, CatalogProduct product, Brand brand) {
        if (product.getSourceType() != CatalogSourceType.VERIFIED_BRAND_PROFILE || !visible(product, brand)) return;
        var piece = product.getManagedPiece();
        card.put("wardrobeItemId", piece.getId());
        card.put("expiresAt", piece.getExpiresAt());
        card.put("physicalStoreItemId", piece.getPhysicalStoreItemId());
        card.put("price", piece.getPrice());
        card.put("auraMetamorphoseStatus", piece.getAuraMetamorphoseStatus());
        if (piece.getModel3dStatus() == br.com.fashionai.domain.model.enums.Model3dStatus.COMPLETED) {
            card.put("model3dUrl", piece.getModel3dUrl());
        }
    }
}
