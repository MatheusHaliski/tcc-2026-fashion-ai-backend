package br.com.fashionai.application.service;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.PhysicalStoreListing;
import br.com.fashionai.domain.model.PhysicalStoreOrder;
import br.com.fashionai.domain.model.PhysicalStoreVariant;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.UserRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Projeções da loja física (oferta, pedido, lançamento de pontos). Sem transação nem autorização. */
final class PhysicalStoreViews {
    private final CatalogService catalog;
    private final WardrobeCreatorService creator;
    private final UserRepository users;

    PhysicalStoreViews(CatalogService catalog, WardrobeCreatorService creator, UserRepository users) {
        this.catalog = catalog;
        this.creator = creator;
        this.users = users;
    }

    /** Estoque vendável: com variantes, a soma do que cada SKU ainda pode resgatar; sem variantes, o legado da oferta. */
    static int sellableStock(PhysicalStoreListing listing, List<PhysicalStoreVariant> variants) {
        List<PhysicalStoreVariant> active = variants.stream().filter(PhysicalStoreVariant::isActive).toList();
        if (active.isEmpty()) return listing.getStockQuantity();
        return active.stream().mapToInt(PhysicalStoreVariant::available).sum();
    }

    Map<String, Object> listingView(PhysicalStoreListing listing, boolean sellerView, FaiPointsService.Level level, long balance,
                                    List<PhysicalStoreVariant> variants) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", listing.getId());
        out.put("product", catalog.product(listing.getProduct().getId()));
        out.put("description", listing.getDescription());
        out.put("pricePoints", listing.getPricePoints());
        out.put("requiredLevel", listing.getRequiredLevel());
        out.put("levelOk", level.atLeast(FaiPointsService.Level.parse(listing.getRequiredLevel())));
        out.put("affordable", balance >= listing.getPricePoints());
        out.put("stock", sellableStock(listing, variants));
        out.put("active", listing.isActive());
        out.put("seller", creator.identity(users.findById(listing.getSellerUserId()).orElseThrow()));
        out.put("createdAt", listing.getCreatedAt());
        // RF-PESQ-01 — "sem variantes cadastradas" é informação ausente, não indisponibilidade.
        long activeVariants = variants.stream().filter(PhysicalStoreVariant::isActive).count();
        out.put("variantInfo", activeVariants == 0 ? "MISSING" : "PRESENT");
        out.put("variantCount", activeVariants);
        if (!sellerView) out.remove("stock");
        return out;
    }

    static Map<String, Object> variantView(PhysicalStoreVariant v, boolean sellerView) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", v.getId());
        out.put("catalogVariantId", v.getCatalogVariantId());
        out.put("sku", v.getSku());
        out.put("colorName", v.getColorName());
        out.put("sizeLabel", v.getSizeLabel());
        out.put("availability", !v.isActive() ? "INACTIVE" : v.available() > 0 ? "AVAILABLE" : "SOLD_OUT");
        out.put("version", v.getVersion());
        if (sellerView) {
            out.put("stock", v.getStockQuantity());
            out.put("reserved", v.getReservedQuantity());
            out.put("active", v.isActive());
        }
        return out;
    }

    Map<String, Object> orderView(PhysicalStoreOrder order, boolean adminView) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", order.getId());
        out.put("listingId", order.getListing().getId());
        out.put("product", catalog.product(order.getListing().getProduct().getId()));
        out.put("seller", creator.identity(users.findById(order.getListing().getSellerUserId()).orElseThrow()));
        out.put("pricePoints", order.getPricePoints());
        out.put("status", order.getStatus());
        out.put("trackingCode", order.getTrackingCode());
        out.put("trackingUrl", order.getTrackingUrl());
        out.put("shippedAt", order.getShippedAt());
        out.put("deliveredAt", order.getDeliveredAt());
        out.put("createdAt", order.getCreatedAt());
        out.put("variant", orderVariant(order));
        out.put("variantInfo", order.getVariantId() == null ? "MISSING" : "PRESENT");
        if (adminView) {
            out.put("shippingAddress", Json.read(order.getShippingAddress(), Map.class));
            out.put("buyer", users.findById(order.getBuyerUserId()).map(User::getUsername).orElse(null));
        }
        return out;
    }

    /** O SKU do pedido é o retrato gravado na compra: não segue alterações posteriores da variante. */
    static Map<String, Object> orderVariant(PhysicalStoreOrder order) {
        if (order.getVariantId() == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", order.getVariantId());
        out.put("sku", order.getVariantSku());
        out.put("colorName", order.getVariantColor());
        out.put("sizeLabel", order.getVariantSize());
        return out;
    }

    static FaiPointsLedgerEntry pointsEntry(UUID userId, int delta, String action, String refType, String refId) {
        FaiPointsLedgerEntry entry = new FaiPointsLedgerEntry();
        entry.setUserId(userId);
        entry.setDelta(delta);
        entry.setActionCode(action);
        entry.setRefType(refType);
        entry.setRefId(refId);
        entry.setIdempotencyKey(userId + ":" + action + ":" + refId);
        entry.setCountsLifetime(false);
        return entry;
    }
}
