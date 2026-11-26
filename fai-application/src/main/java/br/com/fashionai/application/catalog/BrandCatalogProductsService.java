package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Produtos do catálogo da própria marca por segmento (roupa, calçado, acessório). Saiu da antiga loja física
 * (retirada em 26/11/2026, docs/futuro/loja-fisica) porque a declaração de acessibilidade da marca escolhe o produto
 * por aqui; mesmo contrato e mesmos erros de antes.
 */
@Service
public class BrandCatalogProductsService {
    private static final Set<String> CLOTHING = Set.of("upper_piece", "lower_piece", "full_body_piece");

    private final CatalogProductRepository products;
    private final BrandRepository brands;
    private final CatalogService catalog;
    private final Guard guard;

    public BrandCatalogProductsService(CatalogProductRepository products, BrandRepository brands, CatalogService catalog, Guard guard) {
        this.products = products;
        this.brands = brands;
        this.catalog = catalog;
        this.guard = guard;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> sellerProducts(CurrentUser user, String category) {
        guard.requireApprovedInstitutional(user, "physical-store:listings", "Only approved brands and celebrities can sell products.");
        String normalized = category == null ? "" : category.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("CLOTHING", "SHOES", "ACCESSORIES").contains(normalized)) {
            throw ApiException.badRequest("CATEGORIA_INVALIDA", "Choose clothing, shoes, or accessories.");
        }
        String brandId = brands.findByBrandProfile_Owner_Id(user.id()).map(b -> b.getId().toString()).orElse(null);
        Set<String> categories = switch (normalized) {
            case "CLOTHING" -> CLOTHING;
            case "SHOES" -> Set.of("shoes_piece");
            default -> Set.of("accessory_piece");
        };
        return categories.stream().flatMap(value -> products.browse(brandId, value, null, null, null, null, null, null, PageRequest.of(0, 96))
                .getContent().stream()).map(p -> catalog.product(p.getId())).toList();
    }
}
