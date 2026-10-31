package br.com.fashionai.application.catalog;

import br.com.fashionai.application.catalog.image.CatalogImageIdentity;
import br.com.fashionai.application.catalog.image.CatalogImagePipelineService;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;

import java.time.Instant;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Política pura da foto de cada peça (card, ficha, busca e "adicionar ao guarda-roupa"). O {@link CatalogService} faz as
 * consultas; esta classe só decide, sem repositório, Spring ou rede:
 * <ol>
 *   <li>camadas: principal da ingestão › canônica do pipeline (sobrescreve) › a foto utilizável mais antiga;</li>
 *   <li>foto {@code REJECTED} (uso ou revisão) ou sem URL nunca entra;</li>
 *   <li>foto presa a variante de outro produto ou inexistente sai — SKU e cor ficam na mesma {@link CatalogVariant};</li>
 *   <li>preferência: photo set {@code READY} › canônica › principal › id; uma READY substitui a principal não READY,
 *       nunca o contrário.</li>
 * </ol>
 * O status do photo set ({@link CatalogImagePipelineService#photoSet}, que lê JSON) é calculado uma vez por foto e
 * memorizado nesta instância: antes era refeito a cada comparação da ordenação.
 */
final class CatalogPhotoChoice {
    private final Map<UUID, CatalogProduct> context;
    private final Map<UUID, List<CatalogVariant>> variantsBy;
    private final Map<CatalogImage, Boolean> ready = new IdentityHashMap<>();

    /** Contexto de produtos e variantes de uma consulta; {@code products} sem ids repetidos (como antes, via toMap). */
    CatalogPhotoChoice(List<CatalogProduct> products, Map<UUID, List<CatalogVariant>> variantsBy) {
        this.context = products.stream().collect(Collectors.toMap(CatalogProduct::getId, p -> p));
        this.variantsBy = variantsBy;
    }

    static boolean usable(CatalogImage i) {
        return i.getUsageStatus() != CatalogImageUsage.REJECTED
                && !"REJECTED".equals(i.getReviewStatus())
                && i.getImageUrl() != null && !i.getImageUrl().isBlank();
    }

    /** Principal utilizável (a primeira por produto) e, por cima, a canônica utilizável do pipeline. */
    static Map<UUID, CatalogImage> primaryThenCanonical(List<CatalogImage> primary, List<CatalogImage> canonical) {
        Map<UUID, CatalogImage> main = new HashMap<>();
        for (CatalogImage i : primary) {
            if (usable(i)) {
                main.putIfAbsent(i.getProductId(), i);
            }
        }
        canonical.stream().filter(CatalogPhotoChoice::usable).forEach(c -> main.put(c.getProductId(), c));
        return main;
    }

    /** Produtos ainda sem foto, na ordem pedida. */
    static List<UUID> missing(List<UUID> ids, Map<UUID, CatalogImage> main) {
        return ids.stream().filter(id -> !main.containsKey(id)).toList();
    }

    /** Completa os que faltam com a foto utilizável mais antiga (sem data por último; empate pela URL). */
    static void fillWithOldest(Map<UUID, CatalogImage> main, List<CatalogImage> others) {
        others.stream().filter(CatalogPhotoChoice::usable)
                .sorted(Comparator.comparing((CatalogImage i) -> i.getCreatedAt() == null ? Instant.MAX : i.getCreatedAt())
                        .thenComparing(i -> String.valueOf(i.getImageUrl())))
                .forEach(i -> main.putIfAbsent(i.getProductId(), i));
    }

    /** Tira a foto que não pertence ao produto ou à variante dele. */
    void dropForeign(Map<UUID, CatalogImage> main) {
        main.entrySet().removeIf(e -> !belongs(e.getValue()));
    }

    /** Produtos cuja foto atual (ou a falta dela) não tem photo set READY. */
    List<UUID> notReady(List<UUID> ids, Map<UUID, CatalogImage> main) {
        return ids.stream().filter(id -> !ready(main.get(id))).toList();
    }

    /** Uma alternativa READY vence a atual não READY; sem foto atual, vale a primeira pela preferência. */
    void preferReady(Map<UUID, CatalogImage> main, List<CatalogImage> candidates) {
        candidates.stream().filter(CatalogPhotoChoice::usable).filter(this::belongs).sorted(preference())
                .forEach(image -> {
                    UUID id = image.getProductId();
                    if (!main.containsKey(id) || ready(image) && !ready(main.get(id))) main.put(id, image);
                });
    }

    /** A melhor foto utilizável do produto para a variante pedida (ou da foto pedida), ou null. */
    static CatalogImage select(CatalogProduct product, List<CatalogImage> candidates, List<CatalogVariant> productVariants,
                               CatalogVariant requested, UUID imageId) {
        CatalogPhotoChoice choice = new CatalogPhotoChoice(List.of(product), Collections.singletonMap(product.getId(), productVariants));
        return candidates.stream().filter(CatalogPhotoChoice::usable).filter(i -> imageId == null || imageId.equals(i.getId()))
                .filter(i -> CatalogImageIdentity.matches(i, product, requested, productVariants))
                .sorted(choice.preference()).findFirst().orElse(null);
    }

    private Comparator<CatalogImage> preference() {
        return Comparator.comparing((CatalogImage i) -> !ready(i)).thenComparing(i -> !i.isCanonical())
                .thenComparing(i -> !i.isPrimary()).thenComparing(i -> String.valueOf(i.getId()));
    }

    private boolean belongs(CatalogImage image) {
        return CatalogImageIdentity.matches(image, context.get(image.getProductId()), null, variantsOf(image.getProductId()));
    }

    private boolean ready(CatalogImage image) {
        if (image == null) {
            return false;
        }
        return ready.computeIfAbsent(image, i -> "READY".equals(CatalogImagePipelineService.photoSet(i, context.get(i.getProductId()),
                variantsOf(i.getProductId())).get("status")));
    }

    private List<CatalogVariant> variantsOf(UUID productId) {
        return variantsBy.getOrDefault(productId, List.of());
    }
}
