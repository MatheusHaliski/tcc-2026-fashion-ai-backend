package br.com.fashionai.application.service;

import br.com.fashionai.application.catalog.CatalogPhotoEligibility;
import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Produtos do catálogo de marcas no espelho (RF33 + RF47): o que pode ser vestido e como aparece. Só entra produto que
 * existe e está visível no catálogo (os mesmos estados da busca, sem a quarentena de foto) — o id vem do cliente, o
 * resto é sempre lido daqui. A vista tem o formato da peça do guarda-roupa ({@link MirrorPieceViews}) com a origem
 * ({@code source: "catalog"}), a marca, o card da foto do catálogo e as referências que o 3D usa para a textura.
 */
@Component
public class MirrorCatalogPieces {
    /** Peças do catálogo vestidas, já com as vistas; {@code changed}: alguma referência saiu e o estado precisa ser gravado. */
    public record Worn(Map<String, Map<String, Object>> bySlot, List<Map<String, Object>> accessories, boolean changed) {
        static final Worn NONE = new Worn(Map.of(), List.of(), false);

        Map<String, Object> view(String slot) {
            return bySlot.get(slot);
        }

        /** Acessórios da pessoa e, depois deles, os do catálogo. */
        List<Map<String, Object>> withAccessories(List<Map<String, Object>> own) {
            List<Map<String, Object>> out = new ArrayList<>(own);
            out.addAll(accessories);
            return out;
        }
    }

    private final CatalogProductRepository products;
    private final CatalogService catalog;

    public MirrorCatalogPieces(CatalogProductRepository products, CatalogService catalog) {
        this.products = products;
        this.catalog = catalog;
    }

    static boolean visible(CatalogProduct p) {
        return p != null && CatalogService.VISIBLE.contains(p.getIngestionStatus()) && !CatalogPhotoEligibility.excluded(p);
    }

    /** O produto que a pessoa pediu para vestir: 404 quando não existe ou não está visível no catálogo. */
    public CatalogProduct wearable(UUID productId) {
        if (productId == null) {
            throw ApiException.badRequest("PRODUTO_OBRIGATORIO", Msg.t("mirror.catalogo.escolha_um_produto"));
        }
        return products.findById(productId).filter(MirrorCatalogPieces::visible)
                .orElseThrow(() -> ApiException.notFound(Msg.t("catalog.produto")));
    }

    /**
     * As peças do catálogo vestidas no estado: a peça da pessoa manda no lugar dividido, e o produto que saiu do catálogo
     * (removido, rejeitado ou em quarentena) sai do espelho — como a peça apagada do guarda-roupa.
     */
    public Worn worn(Map<String, Object> slots) {
        if (MirrorCatalogSlots.all(slots).isEmpty()) {
            return Worn.NONE;
        }
        boolean changed = MirrorCatalogSlots.yieldToWardrobe(slots);
        Map<UUID, CatalogProduct> found = products.findAllById(MirrorCatalogSlots.all(slots)).stream().filter(MirrorCatalogPieces::visible)
                .collect(Collectors.toMap(CatalogProduct::getId, Function.identity(), (a, b) -> a));
        changed |= MirrorCatalogSlots.retainOnly(slots, found.keySet());
        Map<String, Map<String, Object>> bySlot = new LinkedHashMap<>();
        for (String slot : MirrorCatalogSlots.SINGLE) {
            UUID id = MirrorCatalogSlots.single(slots, slot);
            if (id != null) {
                bySlot.put(slot, view(found.get(id)));
            }
        }
        List<Map<String, Object>> acc = MirrorCatalogSlots.accessories(slots).stream().map(id -> view(found.get(id))).toList();
        return new Worn(bySlot, acc, changed);
    }

    /** Vista do produto no espelho a partir do card do catálogo (foto escolhida pelo pipeline, cor da variante, modelo 3D). */
    @SuppressWarnings("unchecked")
    Map<String, Object> view(CatalogProduct p) {
        Map<String, Object> card = catalog.product(p.getId());
        Map<String, Object> image = card.get("catalogImage") instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
        Map<String, Object> whole = image != null && image.get("whole") instanceof Map<?, ?> w ? (Map<String, Object>) w : null;
        Map<String, Object> variant = card.get("selectedVariant") instanceof Map<?, ?> v ? (Map<String, Object>) v : null;
        Map<String, Object> source = card.get("source") instanceof Map<?, ?> s ? (Map<String, Object>) s : Map.of();
        Object officialUrl = source.get("productUrl");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", "c:" + p.getId());
        m.put("source", "catalog");
        m.put("productId", p.getId());
        m.put("variantId", variant != null ? variant.get("id") : image == null ? null : image.get("variantId"));
        m.put("imageId", image == null ? null : image.get("imageId"));
        m.put("name", card.get("productName"));
        m.put("brand", card.get("brand"));
        for (String k : List.of("category", "subcategory", "color", "colorName", "colorHex", "variation", "attributes", "imageUrl", "model3dUrl")) {
            m.put(k, card.get(k));
        }
        m.put("thumbnailUrl", image == null ? null : image.get("thumbnailUrl"));
        // a peça recortada sem pessoa (900×1200, nosso armazenamento): a mesma foto que o provador usa no 3D
        m.put("studioImageUrl", whole != null && Boolean.TRUE.equals(whole.get("processed")) ? whole.get("url") : null);
        m.put("catalogImage", image);
        m.put("officialUrl", officialUrl == null || "null".equals(officialUrl) ? null : officialUrl);
        m.put("available", true);
        m.put("slot", MirrorService.slotOf(p.getCategory(), p.getSubcategory()));
        return m;
    }
}
