package br.com.fashionai.application.accessibility;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogAccessibilityAttributes;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogAccessibilityAttributesRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import static br.com.fashionai.application.accessibility.AccessibilityRules.*;

/**
 * RF-PESQ-08 — busca por acessibilidade de uso e conforto verificável. A marca declara atributos estruturados com a
 * origem; a equipe pode revisar; a busca distingue declarado, revisado e sem informação. Filtros são por requisição:
 * nenhuma preferência, diagnóstico ou condição de saúde é armazenada ou publicada no perfil.
 */
@Service
@Transactional
public class AccessibilityService {
    public record Declaration(String declarationSource, String closureType, String openingPosition, String magneticClosure, String taglessLabel,
                              String flatSeams, String fabricContact, String oneHandDressing, String notes, Long expectedVersion) { }

    private final CatalogAccessibilityAttributesRepository attributes;
    private final CatalogProductRepository products;
    private final BrandRepository brands;
    private final CatalogService catalog;
    private final Guard guard;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public AccessibilityService(CatalogAccessibilityAttributesRepository attributes, CatalogProductRepository products, BrandRepository brands, CatalogService catalog, Guard guard) {
        this(attributes, products, brands, catalog, guard, Clock.systemUTC());
    }

    AccessibilityService(CatalogAccessibilityAttributesRepository attributes, CatalogProductRepository products, BrandRepository brands, CatalogService catalog, Guard guard, Clock clock) {
        this.attributes = attributes; this.products = products; this.brands = brands; this.catalog = catalog; this.guard = guard; this.clock = clock;
    }

    /** CA1 — somente a marca dona do produto declara, informando a origem; nada é inferido de foto ou tecido. */
    public Map<String, Object> declare(CurrentUser user, UUID productId, Declaration d) {
        guard.requireApprovedInstitutional(user, "accessibility:" + productId, "Only approved brands declare accessibility attributes.");
        CatalogProduct product = products.findById(productId).orElseThrow(() -> ApiException.notFound("Produto"));
        UUID brandId = brands.findByBrandProfile_Owner_Id(user.id()).map(b -> b.getId()).orElseThrow(() -> ApiException.forbidden("Conta sem marca associada."));
        if (!brandId.equals(product.getBrandId())) throw ApiException.forbidden("A marca só declara atributos dos próprios produtos.");
        if (d == null || d.declarationSource() == null || !SOURCES.contains(d.declarationSource())) throw ApiException.badRequest("ACCESSIBILITY_SOURCE", "Informe a origem da declaração (ficha da marca, amostra física ou ficha do fornecedor).");
        CatalogAccessibilityAttributes a = attributes.findByProductId(productId).orElseGet(() -> { var fresh = new CatalogAccessibilityAttributes(); fresh.setProductId(productId); return fresh; });
        if (a.getId() != null && d.expectedVersion() != null && a.getVersion() != d.expectedVersion()) throw ApiException.conflict("ACCESSIBILITY_VERSION", "A declaração mudou. Atualize a página.");
        a.setDeclaredBy(user.id()); a.setDeclarationSource(d.declarationSource());
        a.setClosureType(vocab(d.closureType(), CLOSURES)); a.setOpeningPosition(vocab(d.openingPosition(), OPENINGS)); a.setFabricContact(vocab(d.fabricContact(), CONTACTS));
        a.setMagneticClosure(vocab(d.magneticClosure(), TRI)); a.setTaglessLabel(vocab(d.taglessLabel(), TRI)); a.setFlatSeams(vocab(d.flatSeams(), TRI)); a.setOneHandDressing(vocab(d.oneHandDressing(), TRI));
        a.setNotes(d.notes() == null || d.notes().isBlank() ? null : InputSanitizer.clean(d.notes(), 1000));
        // Qualquer alteração da marca volta ao estado "declarado": a revisão editorial vale para o conteúdo revisado.
        a.setReviewStatus("DECLARED"); a.setReviewedBy(null); a.setReviewedAt(null);
        return view(attributes.saveAndFlush(a));
    }

    /** Revisão editorial (equipe): confirma a declaração sem alterá-la. */
    public Map<String, Object> review(CurrentUser admin, UUID productId) {
        guard.requireAdmin(admin);
        CatalogAccessibilityAttributes a = attributes.findByProductId(productId).orElseThrow(() -> ApiException.notFound("Declaração"));
        a.setReviewStatus("REVIEWED"); a.setReviewedBy(admin.id()); a.setReviewedAt(clock.instant());
        return view(attributes.saveAndFlush(a));
    }

    /** CA3/CA4 — ficha do produto: declarado, revisado ou sem informação, em linguagem concreta. */
    @Transactional(readOnly = true)
    public Map<String, Object> product(UUID productId) {
        products.findById(productId).orElseThrow(() -> ApiException.notFound("Produto"));
        return attributes.findByProductId(productId).map(this::view).orElseGet(() -> unknown(productId));
    }

    /** CA2/CA3 — filtros por requisição (nada é gravado); resultados separam confirmados de "sem informação". */
    @Transactional(readOnly = true)
    public Map<String, Object> search(Filters filters, String category, int limit) {
        int max = Math.min(60, Math.max(1, limit));
        List<Map<String, Object>> matches = new ArrayList<>();
        List<Map<String, Object>> unknown = new ArrayList<>();
        int unknownCount = 0;
        for (CatalogAccessibilityAttributes a : attributes.findTop200ByOrderByUpdatedAtDesc()) {
            CatalogProduct p = products.findById(a.getProductId()).orElse(null);
            if (p == null || (category != null && !category.isBlank() && !category.equalsIgnoreCase(p.getCategory()))) continue;
            List<String> unknownFilters = unknownFor(a, filters);
            if (matches(a, filters)) { if (matches.size() < max) matches.add(result(p, a, List.of())); }
            else if (!unknownFilters.isEmpty()) { unknownCount++; if (unknown.size() < max) unknown.add(result(p, a, unknownFilters)); }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("filters", filters);
        out.put("results", matches);
        out.put("withoutInformation", unknown);
        out.put("withoutInformationCount", unknownCount);
        out.put("notice", "NO_DATA_IS_NOT_UNSUITABLE");
        out.put("preferencesStored", false);
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(CurrentUser user) {
        guard.requireApprovedInstitutional(user, "accessibility", "Only approved brands declare accessibility attributes.");
        return attributes.findByDeclaredBy(user.id()).stream().map(this::view).toList();
    }

    private Map<String, Object> result(CatalogProduct p, CatalogAccessibilityAttributes a, List<String> unknownFilters) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("product", catalog.product(p.getId()));
        out.put("accessibility", view(a));
        out.put("unknownFilters", unknownFilters);
        return out;
    }

    private Map<String, Object> view(CatalogAccessibilityAttributes a) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("productId", a.getProductId());
        out.put("status", a.getReviewStatus());
        out.put("declarationSource", a.getDeclarationSource());
        out.put("values", values(a));
        out.put("descriptionKeys", descriptionKeys(a));
        out.put("notes", a.getNotes());
        out.put("reviewedAt", a.getReviewedAt());
        out.put("updatedAt", a.getUpdatedAt());
        out.put("version", a.getVersion());
        out.put("clinicalClaim", "NONE");
        out.put("validatedWithUsers", false);
        return out;
    }

    private static Map<String, Object> unknown(UUID productId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("productId", productId);
        out.put("status", "UNKNOWN");
        out.put("values", Map.of());
        out.put("descriptionKeys", List.of());
        out.put("clinicalClaim", "NONE");
        out.put("validatedWithUsers", false);
        return out;
    }

    private static String vocab(String value, java.util.Set<String> allowed) {
        String v = value == null || value.isBlank() ? "UNKNOWN" : value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(v)) throw ApiException.badRequest("ACCESSIBILITY_VALUE", "Valor fora do vocabulário: " + v);
        return v;
    }
}
