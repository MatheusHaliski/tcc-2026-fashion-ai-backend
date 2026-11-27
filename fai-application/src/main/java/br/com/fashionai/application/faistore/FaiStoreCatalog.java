package br.com.fashionai.application.faistore;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.AuraArtOffer;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.repository.AuraArtOfferRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Vitrine da Loja FAI Points, montada a partir do que o app já tem: presets de arte Aura ativos ({@code aura_art_offers}),
 * peças do catálogo oficial das marcas e os itens curados de {@code store/fai-store-catalog.json} (guarda-roupas e
 * itens do Acervo, molduras de card de peça e de look, presets de Aura assinados). Nenhum item físico, nenhum
 * pagamento externo.
 */
@Component
public class FaiStoreCatalog {
    static final String AURA_PREFIX = "AURA_";
    static final String PIECE_PREFIX = "PIECE_";
    private static final int BRAND_PIECES = 24;
    private static final Map<String, Integer> PIECE_PRICE = Map.of("upper_piece", 180, "lower_piece", 160,
            "full_body_piece", 240, "shoes_piece", 200, "accessory_piece", 120);

    private final AuraArtOfferRepository offers;
    private final CatalogProductRepository products;
    private final CatalogService catalog;
    private final List<Map<String, Object>> curated;

    public FaiStoreCatalog(AuraArtOfferRepository offers, CatalogProductRepository products, CatalogService catalog) {
        this.offers = offers;
        this.products = products;
        this.catalog = catalog;
        this.curated = loadCurated();
    }

    /** Vitrine inteira, na ordem dos filtros. */
    public List<FaiStoreItem> all() {
        List<FaiStoreItem> out = new ArrayList<>();
        offers.findByActiveTrueOrderByPricePointsAsc().forEach(o -> out.add(aura(o)));
        curated.forEach(raw -> out.add(curated(raw)));
        products.browse(null, null, null, null, null, null, null, null, PageRequest.of(0, BRAND_PIECES)).getContent().stream()
                .filter(p -> p.getBrandId() != null).map(this::piece).flatMap(Optional::stream).forEach(out::add);
        out.sort(java.util.Comparator.comparingInt(i -> FaiStoreItem.TYPES.indexOf(i.type())));
        return out;
    }

    /** Um item pelo id, inclusive os que saíram da primeira página da vitrine (peças) ou foram desativados (nulo). */
    public Optional<FaiStoreItem> find(String id) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        if (id.startsWith(AURA_PREFIX)) {
            return offers.findById(id.substring(AURA_PREFIX.length())).filter(AuraArtOffer::isActive).map(this::aura);
        }
        if (id.startsWith(PIECE_PREFIX)) {
            try {
                return products.findById(UUID.fromString(id.substring(PIECE_PREFIX.length())))
                        .filter(p -> p.getBrandId() != null).flatMap(this::piece);
            } catch (IllegalArgumentException ex) {
                return Optional.empty();
            }
        }
        return curated.stream().filter(raw -> id.equals(raw.get("id"))).findFirst().map(this::curated);
    }

    private FaiStoreItem aura(AuraArtOffer o) {
        return new FaiStoreItem(AURA_PREFIX + o.getCode(), "AURA_PRESET", o.getName(), Msg.t("faiStore.aura.family." + o.getFamily()),
                o.getPricePoints(), o.getCode(), Json.map(o.getConfigJson()), null, null);
    }

    @SuppressWarnings("unchecked")
    private FaiStoreItem curated(Map<String, Object> raw) {
        String id = (String) raw.get("id");
        return new FaiStoreItem(id, (String) raw.get("type"), Msg.t("faiStore.item." + id + ".name"), Msg.t("faiStore.item." + id + ".desc"),
                ((Number) raw.get("pricePoints")).intValue(), null, (Map<String, Object>) raw.get("visual"),
                (Map<String, Object>) raw.get("creator"), null);
    }

    @SuppressWarnings("unchecked")
    private Optional<FaiStoreItem> piece(CatalogProduct p) {
        Map<String, Object> card;
        try {
            card = catalog.product(p.getId());
        } catch (ApiException ex) {
            return Optional.empty();   // produto fora da vitrine (sem foto elegível ou retirado)
        }
        if (card.get("imageUrl") == null || !(card.get("brand") instanceof Map<?, ?> brand)) {
            return Optional.empty();
        }
        Map<String, Object> creator = Map.of("name", String.valueOf(brand.get("name")), "kind", "MARCA", "slug", String.valueOf(brand.get("slug")));
        Map<String, Object> product = new java.util.LinkedHashMap<>();
        for (String key : List.of("id", "productName", "category", "colorName", "imageUrl", "catalogImage")) {
            product.put(key, card.get(key));
        }
        String name = String.valueOf(card.get("productName"));
        return Optional.of(new FaiStoreItem(PIECE_PREFIX + p.getId(), "BRAND_PIECE", name, Msg.t("faiStore.piece.desc", brand.get("name")),
                PIECE_PRICE.getOrDefault(p.getCategory(), 150), null, null, creator, product));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> loadCurated() {
        try (InputStream in = new ClassPathResource("store/fai-store-catalog.json").getInputStream()) {
            Map<String, Object> root = Json.MAPPER.readValue(in, Map.class);
            return List.copyOf((List<Map<String, Object>>) root.get("items"));
        } catch (IOException ex) {
            throw new IllegalStateException("Catálogo da Loja FAI Points ilegível", ex);
        }
    }
}
