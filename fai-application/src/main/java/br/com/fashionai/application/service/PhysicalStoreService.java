package br.com.fashionai.application.service;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.PhysicalStoreListing;
import br.com.fashionai.domain.model.PhysicalStoreOrder;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.PhysicalStoreListingRepository;
import br.com.fashionai.domain.repository.PhysicalStoreOrderRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

/** Issuer-operated physical product store paid only with earned FAI Points. */
@Service
public class PhysicalStoreService {
    private static final Set<String> CLOTHING = Set.of("upper_piece", "lower_piece", "full_body_piece");
    private static final Set<String> CATEGORIES = Set.of("upper_piece", "lower_piece", "full_body_piece", "shoes_piece", "accessory_piece");
    private static final Set<String> LEVELS = Set.of("ESTREIA", "STUDIO", "LOFT");

    public record ListingForm(UUID productId, String description, Integer pricePoints, String requiredLevel, Boolean active) { }
    public record ShippingAddress(String fullName, String phone, String postalCode, String state, String city,
                                  String neighborhood, String street, String number, String complement) { }
    public record OrderForm(ShippingAddress shippingAddress) { }
    public record StockForm(Integer quantity) { }
    public record ShipmentForm(String status, String trackingCode, String trackingUrl) { }

    private final PhysicalStoreListingRepository listings;
    private final PhysicalStoreOrderRepository orders;
    private final CatalogProductRepository products;
    private final BrandRepository brands;
    private final FaiPointsLedgerEntryRepository ledger;
    private final UserRepository users;
    private final Guard guard;
    private final CatalogService catalog;
    private final WardrobeCreatorService creator;

    public PhysicalStoreService(PhysicalStoreListingRepository listings, PhysicalStoreOrderRepository orders,
                                CatalogProductRepository products, BrandRepository brands, FaiPointsLedgerEntryRepository ledger, UserRepository users,
                                Guard guard, CatalogService catalog, WardrobeCreatorService creator) {
        this.listings = listings;
        this.orders = orders;
        this.products = products;
        this.brands = brands;
        this.ledger = ledger;
        this.users = users;
        this.guard = guard;
        this.catalog = catalog;
        this.creator = creator;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> store(CurrentUser viewer, String segment) {
        String normalized = segment == null ? "" : segment.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("", "CLOTHING", "SHOES", "ACCESSORIES").contains(normalized)) {
            throw ApiException.badRequest("CATEGORIA_INVALIDA", "Choose clothing, shoes, or accessories.");
        }
        FaiPointsService.Level level = FaiPointsService.Level.of(ledger.lifetime(viewer.id()));
        long balance = ledger.balance(viewer.id());
        return listings.findByActiveTrueOrderByCreatedAtDesc().stream()
                .filter(l -> l.getStockQuantity() > 0 && sellerActive(l.getSellerUserId()))
                .filter(l -> belongs(l.getProduct().getCategory(), normalized))
                .map(l -> listingView(l, false, level, balance))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(CurrentUser user) {
        requireSeller(user);
        return listings.findBySellerUserIdOrderByCreatedAtDesc(user.id()).stream()
                .map(l -> listingView(l, true, FaiPointsService.Level.of(ledger.lifetime(user.id())), ledger.balance(user.id())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> sellerProducts(CurrentUser user, String category) {
        requireSeller(user);
        String normalized = category == null ? "" : category.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("CLOTHING", "SHOES", "ACCESSORIES").contains(normalized)) throw ApiException.badRequest("CATEGORIA_INVALIDA", "Choose clothing, shoes, or accessories.");
        String brandId = brands.findByBrandProfile_Owner_Id(user.id()).map(b -> b.getId().toString()).orElse(null);
        Set<String> categories = switch (normalized) {
            case "CLOTHING" -> CLOTHING;
            case "SHOES" -> Set.of("shoes_piece");
            default -> Set.of("accessory_piece");
        };
        return categories.stream().flatMap(value -> products.browse(brandId, value, null, null, null, null, null, null, PageRequest.of(0, 96))
                .getContent().stream()).map(p -> catalog.product(p.getId())).toList();
    }

    @Transactional
    public Map<String, Object> save(CurrentUser user, UUID listingId, ListingForm form) {
        requireSeller(user);
        if (form == null || form.productId() == null) throw ApiException.badRequest("PRODUTO_OBRIGATORIO", "Choose a catalog product.");
        if (form.pricePoints() == null || form.pricePoints() < 1 || form.pricePoints() > 1_000_000) {
            throw ApiException.badRequest("PRECO_INVALIDO", "Price must be between 1 and 1,000,000 FAI Points.");
        }
        String requiredLevel = form.requiredLevel() == null ? "ESTREIA" : form.requiredLevel().trim().toUpperCase(Locale.ROOT);
        if (!LEVELS.contains(requiredLevel)) throw ApiException.badRequest("NIVEL_INVALIDO", "Choose a valid unlock level.");
        CatalogProduct product = products.findById(form.productId()).orElseThrow(() -> ApiException.notFound("Catalog product"));
        if (!Set.of(CatalogIngestionStatus.VALIDATED, CatalogIngestionStatus.PERSISTABLE, CatalogIngestionStatus.REFERENCE_ONLY)
                .contains(product.getIngestionStatus()) || !CATEGORIES.contains(product.getCategory())) {
            throw ApiException.badRequest("PRODUTO_NAO_DISPONIVEL", "This catalog product cannot be listed in the physical store.");
        }
        brands.findByBrandProfile_Owner_Id(user.id()).ifPresent(brand -> {
            if (!brand.getId().equals(product.getBrandId())) {
                throw ApiException.badRequest("PRODUTO_FORA_DA_MARCA", "Brands can only list products from their own catalog.");
            }
        });
        PhysicalStoreListing listing;
        if (listingId == null) {
            listing = new PhysicalStoreListing();
            listing.setSellerUserId(user.id());
            listing.setStockQuantity(0);
        } else {
            listing = listings.findById(listingId).orElseThrow(() -> ApiException.notFound("Store listing"));
            if (!user.id().equals(listing.getSellerUserId())) {
                throw guard.deny(user, "physical-store:listing:" + listingId, "Only the listing owner can edit it.");
            }
        }
        listing.setProduct(product);
        listing.setDescription(form.description() == null || form.description().isBlank()
                ? null : InputSanitizer.clean(form.description(), 1000));
        listing.setPricePoints(form.pricePoints());
        listing.setRequiredLevel(requiredLevel);
        listing.setActive(form.active() == null || form.active());
        return listingView(listings.save(listing), true, FaiPointsService.Level.of(ledger.lifetime(user.id())), ledger.balance(user.id()));
    }

    @Transactional
    public void delete(CurrentUser user, UUID listingId) {
        requireSeller(user);
        PhysicalStoreListing listing = listings.findById(listingId).orElseThrow(() -> ApiException.notFound("Store listing"));
        if (!user.id().equals(listing.getSellerUserId())) {
            throw guard.deny(user, "physical-store:listing:" + listingId, "Only the listing owner can remove it.");
        }
        if (orders.existsByListingId(listingId)) {
            listing.setActive(false);
        } else {
            listings.delete(listing);
        }
    }

    public Map<String, Object> buy(CurrentUser buyer, UUID listingId, OrderForm form) {
        return buy(buyer, listingId, form, null);
    }

    /**
     * {@code requestKey} (cabeçalho Idempotency-Key, gerado uma vez por compra): o mesmo pedido repetido devolve o pedido
     * já criado, sem cobrar nem tirar do estoque de novo. Conferido depois da trava da carteira.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Map<String, Object> buy(CurrentUser buyer, UUID listingId, OrderForm form, String requestKey) {
        ShippingAddress address = validateAddress(form == null ? null : form.shippingAddress());
        PhysicalStoreListing preview = listings.findById(listingId).orElseThrow(() -> ApiException.notFound(Msg.t("physicalStore.oferta")));
        UUID sellerId = preview.getSellerUserId();
        if (buyer.id().equals(sellerId)) throw ApiException.conflict("COMPRA_PROPRIA", Msg.t("physicalStore.compra_propria"));
        Stream.of(buyer.id(), sellerId).distinct().sorted()
                .forEach(id -> ledger.lockOwner(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario"))));
        String requestRef = FaiPointsService.requestRef(requestKey);
        if (requestRef != null) {
            var done = ledger.findByIdempotencyKey(buyer.id() + ":PHYSICAL_STORE_PURCHASE:" + requestRef);
            if (done.isPresent()) {
                PhysicalStoreOrder previous = orders.findById(UUID.fromString(done.get().getRefId()))
                        .orElseThrow(() -> ApiException.notFound(Msg.t("physicalStore.oferta")));
                Map<String, Object> view = new LinkedHashMap<>(orderView(previous, false));
                view.put("repeated", true);
                return view;
            }
        }
        PhysicalStoreListing listing = listings.lockById(listingId).orElseThrow(() -> ApiException.notFound(Msg.t("physicalStore.oferta")));
        if (!listing.isActive() || !sellerActive(listing.getSellerUserId())) {
            throw ApiException.conflict("OFERTA_INDISPONIVEL", Msg.t("physicalStore.oferta_indisponivel"));
        }
        if (listing.getStockQuantity() < 1) throw ApiException.conflict("ESGOTADO", Msg.t("physicalStore.esgotado"));
        FaiPointsService.Level currentLevel = FaiPointsService.Level.of(ledger.lifetime(buyer.id()));
        if (!currentLevel.atLeast(FaiPointsService.Level.parse(listing.getRequiredLevel()))) {
            throw ApiException.conflict("NIVEL_INSUFICIENTE", Msg.t("physicalStore.nivel_insuficiente", listing.getRequiredLevel()));
        }
        long balance = ledger.balance(buyer.id());
        if (balance < listing.getPricePoints()) {
            throw ApiException.conflict("SALDO_INSUFICIENTE", Msg.t("physicalStore.saldo_insuficiente", balance, listing.getPricePoints()));
        }

        listing.setStockQuantity(listing.getStockQuantity() - 1);
        PhysicalStoreOrder order = new PhysicalStoreOrder();
        order.setListing(listing);
        order.setBuyerUserId(buyer.id());
        order.setPricePoints(listing.getPricePoints());
        order.setShippingAddress(Json.write(address));
        order.setStatus("PROCESSING");
        orders.save(order);
        FaiPointsLedgerEntry debit = pointsEntry(buyer.id(), -listing.getPricePoints(), "PHYSICAL_STORE_PURCHASE", "PHYSICAL_ORDER", order.getId().toString());
        if (requestRef != null) debit.setIdempotencyKey(buyer.id() + ":PHYSICAL_STORE_PURCHASE:" + requestRef);
        ledger.save(debit);
        ledger.save(pointsEntry(sellerId, listing.getPricePoints(), "PHYSICAL_STORE_SALE", "PHYSICAL_ORDER", order.getId().toString()));
        return orderView(order, false);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> myOrders(CurrentUser buyer) {
        return orders.findByBuyerUserIdOrderByCreatedAtDesc(buyer.id()).stream().map(o -> orderView(o, false)).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> adminListings(CurrentUser admin) {
        guard.requireAdmin(admin);
        return listings.findAllByOrderByCreatedAtDesc().stream()
                .map(l -> listingView(l, true, FaiPointsService.Level.ESTREIA, 0))
                .toList();
    }

    @Transactional
    public Map<String, Object> updateStock(CurrentUser admin, UUID listingId, StockForm form) {
        guard.requireAdmin(admin);
        if (form == null || form.quantity() == null || form.quantity() < 0 || form.quantity() > 1_000_000) {
            throw ApiException.badRequest("ESTOQUE_INVALIDO", "Stock must be between 0 and 1,000,000.");
        }
        PhysicalStoreListing listing = listings.lockById(listingId).orElseThrow(() -> ApiException.notFound("Store listing"));
        listing.setStockQuantity(form.quantity());
        return listingView(listing, true, FaiPointsService.Level.ESTREIA, 0);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> adminOrders(CurrentUser admin) {
        guard.requireAdmin(admin);
        return orders.findAllByOrderByCreatedAtDesc().stream().map(o -> orderView(o, true)).toList();
    }

    @Transactional
    public Map<String, Object> updateShipment(CurrentUser admin, UUID orderId, ShipmentForm form) {
        guard.requireAdmin(admin);
        if (form == null || form.status() == null) throw ApiException.badRequest("STATUS_INVALIDO", "A shipment status is required.");
        String status = form.status().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PROCESSING", "SHIPPED", "DELIVERED").contains(status)) {
            throw ApiException.badRequest("STATUS_INVALIDO", "Choose PROCESSING, SHIPPED, or DELIVERED.");
        }
        PhysicalStoreOrder order = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order"));
        if ("DELIVERED".equals(status) && !"SHIPPED".equals(order.getStatus()) && !"DELIVERED".equals(order.getStatus())) {
            throw ApiException.conflict("TRANSICAO_INVALIDA", "Ship the order before marking it delivered.");
        }
        String trackingUrl = cleanTrackingUrl(form.trackingUrl());
        order.setTrackingCode(form.trackingCode() == null ? null : InputSanitizer.clean(form.trackingCode(), 120));
        order.setTrackingUrl(trackingUrl);
        order.setStatus(status);
        if ("SHIPPED".equals(status) && order.getShippedAt() == null) order.setShippedAt(Instant.now());
        if ("DELIVERED".equals(status) && order.getDeliveredAt() == null) order.setDeliveredAt(Instant.now());
        return orderView(order, true);
    }

    private void requireSeller(CurrentUser user) {
        guard.requireApprovedInstitutional(user, "physical-store:listings", "Only approved brands and celebrities can sell products.");
    }

    private boolean sellerActive(UUID sellerId) {
        return users.findById(sellerId).map(FlairService::sellerActive).orElse(false);
    }

    private boolean belongs(String category, String segment) {
        return switch (segment) {
            case "CLOTHING" -> CLOTHING.contains(category);
            case "SHOES" -> "shoes_piece".equals(category);
            case "ACCESSORIES" -> "accessory_piece".equals(category);
            default -> CATEGORIES.contains(category);
        };
    }

    private Map<String, Object> listingView(PhysicalStoreListing listing, boolean sellerView,
                                            FaiPointsService.Level level, long balance) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", listing.getId());
        out.put("product", catalog.product(listing.getProduct().getId()));
        out.put("description", listing.getDescription());
        out.put("pricePoints", listing.getPricePoints());
        out.put("requiredLevel", listing.getRequiredLevel());
        out.put("levelOk", level.atLeast(FaiPointsService.Level.parse(listing.getRequiredLevel())));
        out.put("affordable", balance >= listing.getPricePoints());
        out.put("stock", listing.getStockQuantity());
        out.put("active", listing.isActive());
        out.put("seller", creator.identity(users.findById(listing.getSellerUserId()).orElseThrow()));
        out.put("createdAt", listing.getCreatedAt());
        if (!sellerView) out.remove("stock");
        return out;
    }

    private Map<String, Object> orderView(PhysicalStoreOrder order, boolean adminView) {
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
        if (adminView) {
            out.put("shippingAddress", Json.read(order.getShippingAddress(), Map.class));
            out.put("buyer", users.findById(order.getBuyerUserId()).map(User::getUsername).orElse(null));
        }
        return out;
    }

    private FaiPointsLedgerEntry pointsEntry(UUID userId, int delta, String action, String refType, String refId) {
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

    private ShippingAddress validateAddress(ShippingAddress address) {
        if (address == null) throw ApiException.badRequest("ENDERECO_OBRIGATORIO", Msg.t("physicalStore.endereco_obrigatorio"));
        return new ShippingAddress(
                required(address.fullName(), 120, "fullName"),
                required(address.phone(), 40, "phone"),
                required(address.postalCode(), 20, "postalCode"),
                required(address.state(), 80, "state"),
                required(address.city(), 120, "city"),
                required(address.neighborhood(), 120, "neighborhood"),
                required(address.street(), 180, "street"),
                required(address.number(), 30, "number"),
                address.complement() == null || address.complement().isBlank() ? null : InputSanitizer.clean(address.complement(), 160));
    }

    private String required(String value, int max, String field) {
        if (value == null || value.isBlank() || value.trim().length() > max) {
            throw ApiException.badRequest("ENDERECO_INVALIDO", Msg.t("physicalStore.endereco_invalido"), Map.of("field", field));
        }
        return InputSanitizer.clean(value, max);
    }

    private String cleanTrackingUrl(String value) {
        if (value == null || value.isBlank()) return null;
        String url = value.trim();
        if (!url.matches("https://[^\\s]{1,1000}")) {
            throw ApiException.badRequest("RASTREIO_INVALIDO", "Tracking links must use HTTPS.");
        }
        return url;
    }
}
