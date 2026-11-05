package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.PhysicalStoreListing;
import br.com.fashionai.domain.model.PhysicalStoreVariant;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import br.com.fashionai.domain.repository.PhysicalStoreListingRepository;
import br.com.fashionai.domain.repository.PhysicalStoreVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** RF-PESQ-01 — cadastro de variantes (cor × tamanho) por oferta e a tela de checkout do comprador. */
@Service
public class PhysicalStoreVariantService {
    public record VariantForm(UUID catalogVariantId, String sku, String colorName, String sizeLabel, Integer stockQuantity, Boolean active, Long expectedVersion) { }

    private final PhysicalStoreListingRepository listings;
    private final PhysicalStoreVariantRepository variants;
    private final CatalogVariantRepository catalogVariants;
    private final Guard guard;

    public PhysicalStoreVariantService(PhysicalStoreListingRepository listings, PhysicalStoreVariantRepository variants,
                                       CatalogVariantRepository catalogVariants, Guard guard) {
        this.listings = listings;
        this.variants = variants;
        this.catalogVariants = catalogVariants;
        this.guard = guard;
    }

    /** O comprador vê somente variantes da própria oferta; "sem variantes" é informação ausente, não esgotado. */
    @Transactional(readOnly = true)
    public Map<String, Object> checkout(CurrentUser viewer, UUID listingId) {
        guard.requireCanCreate(viewer);
        PhysicalStoreListing listing = listings.findById(listingId).orElseThrow(() -> ApiException.notFound(Msg.t("physicalStore.oferta")));
        List<PhysicalStoreVariant> rows = variants.findByListingIdOrderByVariantKeyAsc(listingId).stream().filter(PhysicalStoreVariant::isActive).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("listingId", listing.getId());
        out.put("pricePoints", listing.getPricePoints());
        out.put("variantInfo", rows.isEmpty() ? "MISSING" : "PRESENT");
        out.put("variantRequired", !rows.isEmpty());
        out.put("variants", rows.stream().map(v -> PhysicalStoreViews.variantView(v, false)).toList());
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(CurrentUser user, UUID listingId) {
        manageable(user, listingId);
        return variants.findByListingIdOrderByVariantKeyAsc(listingId).stream().map(v -> PhysicalStoreViews.variantView(v, true)).toList();
    }

    @Transactional
    public Map<String, Object> save(CurrentUser user, UUID listingId, UUID variantId, VariantForm form) {
        PhysicalStoreListing listing = manageable(user, listingId);
        if (form == null) throw ApiException.badRequest("VARIANTE_INVALIDA", Msg.t("physicalStore.variante_invalida"));
        String size = clean(form.sizeLabel(), 40);
        if (size == null) throw ApiException.badRequest("TAMANHO_OBRIGATORIO", Msg.t("physicalStore.tamanho_obrigatorio"));
        if (form.stockQuantity() == null || form.stockQuantity() < 0 || form.stockQuantity() > 1_000_000) {
            throw ApiException.badRequest("ESTOQUE_INVALIDO", "Stock must be between 0 and 1,000,000.");
        }
        String color = clean(form.colorName(), 120);
        String sku = clean(form.sku(), 80);
        CatalogVariant source = catalogVariant(listing, form.catalogVariantId());
        if (source != null) {
            if (color == null) color = source.getColorName() != null ? source.getColorName() : source.getColor();
            if (sku == null) sku = source.getSku();
        }
        String key = (color == null ? "" : color.toLowerCase(Locale.ROOT)) + "|" + size.toLowerCase(Locale.ROOT);
        PhysicalStoreVariant variant;
        if (variantId == null) {
            if (variants.findByListingIdAndVariantKey(listingId, key).isPresent()) {
                throw ApiException.conflict("VARIANTE_DUPLICADA", Msg.t("physicalStore.variante_duplicada"));
            }
            variant = new PhysicalStoreVariant();
            variant.setListingId(listingId);
        } else {
            variant = variants.lockById(variantId).filter(v -> v.getListingId().equals(listingId))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("physicalStore.variante")));
            if (form.expectedVersion() != null && variant.getVersion() != form.expectedVersion()) {
                throw ApiException.conflict("VARIANTE_VERSAO", Msg.t("physicalStore.variante_versao"));
            }
            variants.findByListingIdAndVariantKey(listingId, key).filter(other -> !other.getId().equals(variantId)).ifPresent(other -> {
                throw ApiException.conflict("VARIANTE_DUPLICADA", Msg.t("physicalStore.variante_duplicada"));
            });
        }
        variant.setCatalogVariantId(source == null ? null : source.getId());
        variant.setVariantKey(key);
        variant.setSku(sku);
        variant.setColorName(color);
        variant.setSizeLabel(size);
        variant.setStockQuantity(form.stockQuantity());
        variant.setActive(form.active() == null || form.active());
        return PhysicalStoreViews.variantView(variants.saveAndFlush(variant), true);
    }

    private CatalogVariant catalogVariant(PhysicalStoreListing listing, UUID catalogVariantId) {
        if (catalogVariantId == null) return null;
        CatalogVariant source = catalogVariants.findById(catalogVariantId)
                .orElseThrow(() -> ApiException.badRequest("VARIANTE_DE_OUTRO_PRODUTO", Msg.t("physicalStore.variante_de_outro_produto")));
        if (!source.getProductId().equals(listing.getProduct().getId())) {
            throw ApiException.badRequest("VARIANTE_DE_OUTRO_PRODUTO", Msg.t("physicalStore.variante_de_outro_produto"));
        }
        return source;
    }

    private PhysicalStoreListing manageable(CurrentUser user, UUID listingId) {
        guard.requireCanCreate(user);
        PhysicalStoreListing listing = listings.findById(listingId).orElseThrow(() -> ApiException.notFound(Msg.t("physicalStore.oferta")));
        if (!user.admin() && !user.id().equals(listing.getSellerUserId())) {
            throw guard.deny(user, "physical-store:listing:" + listingId, "Only the listing owner can manage its variants.");
        }
        return listing;
    }

    private static String clean(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String out = InputSanitizer.clean(value, max);
        return out == null || out.isBlank() ? null : out;
    }
}
