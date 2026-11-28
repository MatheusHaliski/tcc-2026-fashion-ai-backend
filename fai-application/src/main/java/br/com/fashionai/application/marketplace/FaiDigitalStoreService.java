package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.seal.SealDesigns;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.wardrobe.PieceCopy;
import br.com.fashionai.domain.model.FaiDigitalOffer;
import br.com.fashionai.domain.model.FaiDigitalPurchase;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.FaiDigitalOfferRepository;
import br.com.fashionai.domain.repository.FaiDigitalPurchaseRepository;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class FaiDigitalStoreService {
    private static final Set<String> KINDS = Set.of("EXCLUSIVE_PIECE", "ACERVO", "SEAL");

    private final FaiDigitalOfferRepository offers;
    private final FaiDigitalPurchaseRepository purchases;
    private final FaiPointsLedgerEntryRepository ledger;
    private final CatalogProductRepository products;
    private final WardrobeItemRepository pieces;
    private final CatalogService catalog;
    private final Guard guard;

    public FaiDigitalStoreService(FaiDigitalOfferRepository offers, FaiDigitalPurchaseRepository purchases,
                                  FaiPointsLedgerEntryRepository ledger, CatalogProductRepository products,
                                  WardrobeItemRepository pieces, CatalogService catalog, Guard guard) {
        this.offers = offers;
        this.purchases = purchases;
        this.ledger = ledger;
        this.products = products;
        this.pieces = pieces;
        this.catalog = catalog;
        this.guard = guard;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> offers(String kind) {
        return KINDS.contains(kind) ? offers.findByActiveTrueAndKindOrderByPointsAsc(kind).stream()
                .filter(offer -> offer.getStock() == null || offer.getStock() > 0)
                .map(this::availableView).filter(Objects::nonNull).toList() : List.of();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(CurrentUser user) {
        guard.requireSession(user);
        return purchases.findByOwnerIdOrderByPurchasedAtDesc(user.id()).stream().map(FaiDigitalStoreService::receipt).toList();
    }

    @Transactional
    public Map<String, Object> save(CurrentUser user, FaiDigitalOfferForm form) {
        guard.requireAdmin(user);
        if (form.code() == null || !form.code().matches("[A-Z0-9_]{1,64}") || form.kind() == null || !KINDS.contains(form.kind())
                || form.name() == null || form.name().isBlank() || form.name().length() > 160 || form.points() < 1
                || form.points() > 1_000_000 || (form.stock() != null && form.stock() < 0)) {
            throw ApiException.badRequest("INVALID_FAI_OFFER", "Oferta digital inválida.");
        }
        boolean seal = "SEAL".equals(form.kind());
        if (seal == (form.productId() != null) || (seal && form.design() == null)) {
            throw ApiException.badRequest("INVALID_FAI_ASSET", "Informe o produto digital ou o design do selo.");
        }
        Map<String, Object> design = seal ? SealDesigns.normalize(form.design()) : null;
        if (design != null && (design.get("uploadUrl") != null || design.get("core") instanceof Map<?, ?> core
                && core.get("imageUrl") != null)) {
            throw ApiException.badRequest("INVALID_SEAL_TEMPLATE", "Use um design do criador de selos sem arquivo de terceiros.");
        }
        if (!seal) requireProduct(form.productId());
        FaiDigitalOffer offer = offers.findByCode(form.code()).orElseGet(FaiDigitalOffer::new);
        String designJson = design == null ? null : Json.write(design);
        if (offer.getCode() != null && purchases.existsByOffer_Code(form.code()) && (
                !Objects.equals(offer.getKind(), form.kind()) || !Objects.equals(offer.getProductId(), form.productId())
                        || !Objects.equals(offer.getDesignJson(), designJson))) {
            throw ApiException.conflict("FAI_OFFER_LOCKED", "Crie uma nova oferta para alterar um item já adquirido.");
        }
        offer.setCode(form.code());
        offer.setName(form.name().strip());
        offer.setKind(form.kind());
        offer.setProductId(form.productId());
        offer.setDesignJson(designJson);
        offer.setPoints(form.points());
        offer.setStock(form.stock());
        offer.setActive(form.active());
        return view(offers.save(offer));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Map<String, Object> buy(CurrentUser viewer, String code) {
        guard.requireCanCreate(viewer);
        User buyer = ledger.lockOwner(viewer.id()).orElseThrow(() -> ApiException.notFound("Usuário"));
        var existing = purchases.findByOwnerIdAndOffer_Code(viewer.id(), code);
        if (existing.isPresent()) return receipt(existing.get());
        FaiDigitalOffer offer = offers.findByCode(code).orElseThrow(() -> ApiException.notFound("Oferta"));
        if (!offer.isActive() || (offer.getStock() != null && offer.getStock() <= 0)) {
            throw ApiException.conflict("FAI_OFFER_UNAVAILABLE", "Esta oferta não está disponível.");
        }
        if (ledger.balance(viewer.id()) < offer.getPoints()) {
            throw ApiException.conflict("SALDO_INSUFICIENTE", "Saldo de FAI Points insuficiente.");
        }
        FaiDigitalPurchase purchase = new FaiDigitalPurchase();
        purchase.setOwnerId(viewer.id());
        purchase.setOffer(offer);
        purchase.setPoints(offer.getPoints());
        purchase.setPurchasedAt(Instant.now());
        if (offer.getProductId() != null) {
            var source = requireProduct(offer.getProductId());
            if (source.getManagedPiece().getUser().getId().equals(viewer.id())) {
                throw ApiException.badRequest("OWN_FAI_OFFER", "Este item já pertence ao seu guarda-roupa.");
            }
            var copy = PieceCopy.of(source.getManagedPiece(), buyer);
            copy.setCatalogProductId(source.getId());
            copy.setVisibility(Visibility.PRIVATE);
            copy.setModel3dStatus(source.getManagedPiece().getModel3dStatus());
            copy.setModel3dUrl(source.getManagedPiece().getModel3dUrl());
            copy.setCanonicalImageUrl(source.getManagedPiece().getCanonicalImageUrl());
            purchase.setPieceId(pieces.save(copy).getId());
        }
        FaiPointsLedgerEntry debit = new FaiPointsLedgerEntry();
        debit.setUserId(viewer.id());
        debit.setDelta(-offer.getPoints());
        debit.setActionCode("FAI_DIGITAL_PURCHASE");
        debit.setRefType("FAI_DIGITAL_OFFER");
        debit.setRefId(code);
        debit.setIdempotencyKey(viewer.id() + ":FAI_DIGITAL:" + code);
        debit.setCountsLifetime(false);
        ledger.save(debit);
        if (offer.getStock() != null) offer.setStock(offer.getStock() - 1);
        return receipt(purchases.save(purchase));
    }

    private br.com.fashionai.domain.model.CatalogProduct requireProduct(java.util.UUID id) {
        var product = products.findById(id).filter(value -> value.getManagedPiece() != null)
                .orElseThrow(() -> ApiException.notFound("Produto digital da marca"));
        if (!"AVAILABLE".equals(catalog.product(id).get("status"))) {
            throw ApiException.conflict("FAI_PRODUCT_UNAVAILABLE", "O produto digital está fora de venda.");
        }
        return product;
    }

    private Map<String, Object> availableView(FaiDigitalOffer offer) {
        var result = view(offer);
        if (offer.getProductId() == null) return result;
        try {
            requireProduct(offer.getProductId());
            result.put("product", catalog.product(offer.getProductId()));
            return result;
        } catch (ApiException unavailable) {
            if (unavailable.status() == 404 || unavailable.status() == 409) return null;
            throw unavailable;
        }
    }

    private static Map<String, Object> view(FaiDigitalOffer offer) {
        var row = new LinkedHashMap<String, Object>();
        row.put("code", offer.getCode());
        row.put("name", offer.getName());
        row.put("kind", offer.getKind());
        row.put("points", offer.getPoints());
        row.put("stock", offer.getStock());
        row.put("active", offer.isActive());
        return row;
    }

    private static Map<String, Object> receipt(FaiDigitalPurchase purchase) {
        var row = view(purchase.getOffer());
        row.put("pieceId", purchase.getPieceId());
        row.put("pointsPaid", purchase.getPoints());
        row.put("purchasedAt", purchase.getPurchasedAt());
        if (purchase.getOffer().getDesignJson() != null) {
            row.put("design", Json.map(purchase.getOffer().getDesignJson()));
        }
        return row;
    }
}
