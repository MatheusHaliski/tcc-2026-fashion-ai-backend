package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.application.wardrobe.PieceForm;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Supplier;

@Service
@Transactional
public class StorePieceCreator {
    private final WardrobeService wardrobe;
    private final CatalogService catalog;
    private final StoreInventoryService inventory;
    private final CatalogProductRepository products;

    public StorePieceCreator(WardrobeService wardrobe, CatalogService catalog, StoreInventoryService inventory,
                             CatalogProductRepository products) {
        this.wardrobe = wardrobe;
        this.catalog = catalog;
        this.inventory = inventory;
        this.products = products;
    }

    public StorePieceCreated fromPhoto(CurrentUser user, UUID store, PieceForm form) {
        inventory.assertStoreOwner(user, store);
        return assign(user, store, wardrobe.create(user, form));
    }

    public StorePieceCreated fromCatalog(CurrentUser user, UUID store, CatalogService.AddRequest request) {
        inventory.assertStoreOwner(user, store);
        return assign(user, store, catalog.addToWardrobe(user, request));
    }

    public StorePieceCreated photoListing(CurrentUser user, UUID store, LocalDate expiresOn, PieceForm form) {
        return publish(user, store, expiresOn, () -> wardrobe.create(user, form));
    }

    public StorePieceCreated catalogListing(CurrentUser user, UUID store, LocalDate expiresOn, CatalogService.AddRequest form) {
        return publish(user, store, expiresOn, () -> catalog.addToWardrobe(user, form));
    }

    private StorePieceCreated publish(CurrentUser user, UUID store, LocalDate expiresOn, Supplier<Views.PieceView> create) {
        Instant deadline = MarketplaceListingExpiry.deadline(expiresOn, Instant.now());
        if (store != null) inventory.assertStoreOwner(user, store);
        var view = create.get();
        var product = products.findByDedupKey("brand-wardrobe:" + view.id())
                .orElseThrow(() -> ApiException.forbidden("Somente marcas verificadas podem publicar peças à venda."));
        var piece = product.getManagedPiece();
        if (!piece.isForSale() || piece.getNegotiationId() != null) {
            throw ApiException.badRequest("INVALID_BRAND_LISTING", "A peça precisa estar à venda pela própria marca.");
        }
        if (piece.getExpiresAt() == null && deadline != null) {
            piece.setExpiresAt(deadline);
            product.setExpiresAt(deadline);
        }
        if (store != null) return assign(user, store, view);
        return new StorePieceCreated(view.id(), null);
    }

    private StorePieceCreated assign(CurrentUser user, UUID store, Views.PieceView piece) {
        inventory.assign(user, store, piece.id(), true);
        return new StorePieceCreated(piece.id(), store);
    }

    public record StorePieceCreated(UUID id, UUID physicalStoreItemId) {}
}
