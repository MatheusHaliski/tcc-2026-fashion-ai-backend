package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class MarketplaceBrandCatalog {
    private final BrandProfileRepository profiles;
    private final BrandRepository brands;
    private final CatalogService catalog;

    public MarketplaceBrandCatalog(BrandProfileRepository profiles, BrandRepository brands, CatalogService catalog) {
        this.profiles = profiles;
        this.brands = brands;
        this.catalog = catalog;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> browse(String slug, String q, int page) {
        var profile = profiles.findBySlug(slug).filter(p -> p.getApprovalStatus() == ApprovalStatus.APROVADO)
                .orElseThrow(() -> ApiException.notFound("Marca"));
        return brands.findByBrandProfile_Owner_Id(profile.getOwner().getId())
                .map(brand -> catalog.browse(new CatalogService.BrowseRequest(null, null, null, q, page, 24,
                        brand.getId().toString(), null, null, null)))
                .orElseGet(() -> Map.of("items", List.of(), "hasMore", false));
    }
}
