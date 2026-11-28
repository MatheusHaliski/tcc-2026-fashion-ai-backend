package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.PieceCommerceAttributes;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
public class PieceActivityService {
    private final EntityManager entities;
    private final CatalogService catalog;
    private final Guard guard;

    public PieceActivityService(EntityManager entities, CatalogService catalog, Guard guard) {
        this.entities = entities;
        this.catalog = catalog;
        this.guard = guard;
    }

    public void record(CurrentUser user, String entity, UUID id, String action) {
        guard.requireSession(user);
        PieceCommerceAttributes target = switch (entity) {
            case "wardrobe" -> wardrobe(user, id);
            case "catalog" -> catalog(id);
            default -> throw ApiException.notFound("Peça");
        };
        switch (action) {
            case "try-on" -> target.setTryOnCount(target.getTryOnCount() + 1);
            case "view" -> {
                if ("catalog".equals(entity)) target.setViewCount(target.getViewCount() + 1);
            }
            default -> throw ApiException.badRequest("INVALID_PIECE_ACTIVITY", "Atividade não reconhecida.");
        }
    }

    private WardrobeItem wardrobe(CurrentUser user, UUID id) {
        WardrobeItem piece = entities.find(WardrobeItem.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (piece == null || piece.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED) {
            throw ApiException.notFound("Peça");
        }
        if (!piece.getUser().getId().equals(user.id()) && piece.getModerationStatus() != ModerationStatus.APPROVED) {
            throw ApiException.notFound("Peça");
        }
        guard.requireView(user, piece.getUser().getId(), WardrobeService.effectiveVisibility(piece), "piece:" + id);
        return piece;
    }

    private PieceCommerceAttributes catalog(UUID id) {
        catalog.product(id);
        CatalogProduct product = entities.find(CatalogProduct.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (product.getManagedPiece() == null) return product;
        return entities.find(WardrobeItem.class, product.getManagedPiece().getId(), LockModeType.PESSIMISTIC_WRITE);
    }
}
