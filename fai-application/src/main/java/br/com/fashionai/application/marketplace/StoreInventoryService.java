package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.PhysicalStore;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.PhysicalStoreRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
public class StoreInventoryService {
    private final PhysicalStoreRepository stores;
    private final WardrobeItemRepository pieces;
    private final CatalogProductRepository products;
    private final Guard guard;

    public StoreInventoryService(PhysicalStoreRepository stores, WardrobeItemRepository pieces,
                                 CatalogProductRepository products, Guard guard) {
        this.stores = stores;
        this.pieces = pieces;
        this.products = products;
        this.guard = guard;
    }

    public void assign(CurrentUser user, UUID storeId, UUID pieceId, boolean listed) {
        PhysicalStore store = assertStoreOwner(user, storeId);
        var piece = pieces.findForSealRequest(pieceId).filter(item -> item.getUser().getId().equals(user.id()))
                .orElseThrow(() -> ApiException.notFound("Peça da marca"));
        if (!listed) {
            if (storeId.equals(piece.getPhysicalStoreItemId())) piece.setPhysicalStoreItemId(null);
            return;
        }
        boolean inCatalog = products.findByDedupKey("brand-wardrobe:" + pieceId)
                .filter(product -> product.getSourceType() == CatalogSourceType.VERIFIED_BRAND_PROFILE
                        && product.getBrandId().equals(store.getBrand().getId())).isPresent();
        if (!inCatalog || !piece.isForSale() || piece.getVisibility() != Visibility.PUBLIC || piece.getModerationStatus() != ModerationStatus.APPROVED) {
            throw ApiException.badRequest("PIECE_NOT_IN_CATALOG", "Selecione uma peça pública e aprovada do catálogo da marca.");
        }
        piece.setPhysicalStoreItemId(storeId);
    }
    public PhysicalStore assertStoreOwner(CurrentUser user, UUID storeId) {
        guard.requireCanCreate(user);
        PhysicalStore store = stores.detail(storeId).orElseThrow(() -> ApiException.notFound("Loja física"));
        var brand = store.getBrand().getBrandProfile();
        if (brand == null || !brand.getOwner().getId().equals(user.id()) || user.status() != AccountStatus.ACTIVE
                || brand.getApprovalStatus() != ApprovalStatus.APROVADO || !brand.getOwner().isVerified()) {
            throw ApiException.forbidden("Apenas a marca verificada da loja pode alterar a vitrine.");
        }
        return store;
    }
}
