package br.com.fashionai.application.marketplace;

import br.com.fashionai.domain.model.MarketplaceMap;

public record MarketplaceMapView(String slug, String name, String kind, String city,
                                 String region, String country, String imageUrl) {
    static MarketplaceMapView from(MarketplaceMap map) {
        return new MarketplaceMapView(map.getSlug(), map.getName(), map.getKind(),
                map.getCity(), map.getRegion(), map.getCountry(), map.getImageUrl());
    }
}
