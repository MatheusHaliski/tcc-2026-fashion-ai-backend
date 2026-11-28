package br.com.fashionai.web.controller;

import br.com.fashionai.application.marketplace.MarketplaceDirectoryService;
import br.com.fashionai.application.marketplace.MarketplaceMapView;
import br.com.fashionai.application.marketplace.MarketplacePiecePage;
import br.com.fashionai.application.marketplace.MapStoreHighlight;
import br.com.fashionai.application.marketplace.PhysicalStoreView;
import br.com.fashionai.application.marketplace.StorePage;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/marketplace")
public class MarketplaceDirectoryController {
    private final MarketplaceDirectoryService directory;

    public MarketplaceDirectoryController(MarketplaceDirectoryService directory) {
        this.directory = directory;
    }

    @GetMapping("/maps")
    public List<MarketplaceMapView> maps() {
        return directory.maps();
    }

    @GetMapping("/stores")
    public StorePage stores(@RequestParam(required = false) String name,
                            @RequestParam(required = false) String brand,
                            @RequestParam(required = false) String region,
                            @RequestParam(required = false) String map,
                            @RequestParam(required = false) String brandProfile,
                            @RequestParam(defaultValue = "0") int page) {
        return directory.stores(name, brand, region, map, brandProfile, page);
    }

    @GetMapping("/stores/{id}")
    public PhysicalStoreView store(@PathVariable UUID id) {
        return directory.store(id);
    }

    @GetMapping("/maps/{slug}/highlights")
    public List<MapStoreHighlight> highlights(@PathVariable String slug, @RequestParam(required = false) List<UUID> stores) {
        return directory.highlights(slug, stores);
    }

    @GetMapping("/pieces")
    public MarketplacePiecePage pieces(@RequestParam(required = false) String brandProfile,
                                       @RequestParam(required = false) UUID store,
                                       @RequestParam(required = false) String region,
                                       @RequestParam(required = false) String status,
                                       @RequestParam(required = false) String expiry,
                                       @RequestParam(required = false) String name,
                                       @RequestParam(required = false) String brand,
                                       @RequestParam(required = false) String map,
                                       @RequestParam(defaultValue = "false") boolean retail,
                                       @RequestParam(defaultValue = "0") int page) {
        return directory.pieces(brandProfile, store, region, status, expiry, name, brand, map, retail, page);
    }
}
