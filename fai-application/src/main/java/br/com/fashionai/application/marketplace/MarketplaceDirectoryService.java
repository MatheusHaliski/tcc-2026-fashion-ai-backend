package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.MarketplaceMapRepository;
import br.com.fashionai.domain.repository.PhysicalStoreRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class MarketplaceDirectoryService {
    private final MarketplaceMapRepository maps;
    private final PhysicalStoreRepository stores;
    private final BrandProfileRepository profiles;

    public MarketplaceDirectoryService(MarketplaceMapRepository maps, PhysicalStoreRepository stores,
                                       BrandProfileRepository profiles) {
        this.maps = maps;
        this.stores = stores;
        this.profiles = profiles;
    }

    public List<MarketplaceMapView> maps() {
        return maps.findAllByOrderByNameAsc().stream().map(MarketplaceMapView::from).toList();
    }

    public StorePage stores(String name, String brand, String region, String map, String brandProfile, int page) {
        var result = stores.search(text(name), text(brand), text(region), text(map),
                profileId(brandProfile), PageRequest.of(Math.max(0, page), 48));
        return new StorePage(result.stream().map(PhysicalStoreView::from).toList(), result.hasNext());
    }

    public StorePage myStores(CurrentUser viewer, String name, int page) {
        if (viewer == null) throw ApiException.unauthorized("Entre para consultar suas lojas.");
        var profile = profiles.findByOwnerId(viewer.id()).filter(p -> p.getApprovalStatus() == ApprovalStatus.APROVADO)
                .orElseThrow(() -> ApiException.forbidden("A marca precisa ser verificada."));
        var result = stores.search(text(name), "", "", "", profile.getId(), PageRequest.of(Math.max(0, page), 48));
        return new StorePage(result.stream().map(PhysicalStoreView::from).toList(), result.hasNext());
    }

    public PhysicalStoreView store(UUID id) {
        return stores.detail(id).map(PhysicalStoreView::from)
                .orElseThrow(() -> ApiException.notFound("Loja física"));
    }

    public MarketplacePiecePage pieces(String brandProfile, UUID store, String region, String status, String expiry,
                                       String name, String brand, String map, boolean retail, int page) {
        UUID profile = profileId(brandProfile);
        if (profile == null && store == null && !retail) {
            throw ApiException.badRequest("MARKETPLACE_FILTER_REQUIRED", "Informe uma marca ou loja física.");
        }
        var result = stores.pieces(store, profile, text(region), text(status), text(name), text(brand), text(map),
                retail ? "ACTIVE" : text(expiry), Instant.now(), PageRequest.of(Math.max(0, page), 24));
        return new MarketplacePiecePage(result.stream().map(MarketplacePieceView::from).toList(), result.hasNext());
    }

    public List<MapStoreHighlight> highlights(String map, List<UUID> storeIds) {
        if (storeIds == null || storeIds.isEmpty()) return List.of();
        return stores.highlights(text(map), storeIds.stream().distinct().limit(48).toList(),
                Instant.now(), PageRequest.of(0, 4)).stream()
                .map(row -> new MapStoreHighlight((UUID) row[0], MarketplacePieceView.from((WardrobeItem) row[1])))
                .toList();
    }

    private UUID profileId(String slug) {
        return text(slug).isEmpty() ? null : profiles.findBySlug(slug.strip())
                .filter(p -> p.getApprovalStatus() == ApprovalStatus.APROVADO)
                .orElseThrow(() -> ApiException.notFound("Marca")).getId();
    }

    private static String text(String value) {
        String clean = value == null ? "" : value.strip();
        return clean.substring(0, Math.min(160, clean.length()));
    }
}
