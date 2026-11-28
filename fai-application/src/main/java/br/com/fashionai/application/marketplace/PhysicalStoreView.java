package br.com.fashionai.application.marketplace;

import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.PhysicalStore;
import br.com.fashionai.domain.model.enums.ApprovalStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record PhysicalStoreView(UUID id, String name, String address, String city, String region,
                                String country, String brand, String brandProfileSlug, String brandLogoUrl,
                                String mapSlug, String imageUrl, String sourceUrl, String floor,
                                BigDecimal mapX, BigDecimal mapY) {
    static PhysicalStoreView from(PhysicalStore store) {
        var brand = store.getBrand();
        BrandProfile profile = brand.getBrandProfile();
        String slug = profile != null && profile.getApprovalStatus() == ApprovalStatus.APROVADO
                ? profile.getSlug() : null;
        return new PhysicalStoreView(store.getId(), store.getName(), store.getAddress(), store.getCity(),
                store.getRegion(), store.getCountry(), brand.getName(), slug, brand.getLogoUrl(),
                store.getMap() == null ? null : store.getMap().getSlug(), store.getImageUrl(), store.getSourceUrl(),
                store.getFloorLabel(), store.getMapX(), store.getMapY());
    }
}
