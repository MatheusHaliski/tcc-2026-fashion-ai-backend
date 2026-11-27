package br.com.fashionai.application.shopping;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.ShoppingPlanDismissal;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.ShoppingPlanDismissalRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import static br.com.fashionai.application.shopping.ShoppingPlanRules.*;

/**
 * RF-PESQ-09 — lista de compras por lacunas e orçamento. Identifica, por ocasião, os slots sem peça própria e sugere
 * produtos do catálogo que fecham a lacuna, explicando que peças existentes cada um complementa, com preço/fonte/moeda
 * e data da consulta; só preços confirmados entram no somatório garantido. Nunca executa compra.
 */
@Service
@Transactional(readOnly = true)
public class ShoppingPlanService {
    public record Request(List<String> occasions, BigDecimal budget, String currency, List<String> excludedCategories) { }

    private final WardrobeItemRepository pieces;
    private final CatalogProductRepository products;
    private final ShoppingPlanDismissalRepository dismissals;
    private final CatalogService catalog;
    private final Guard guard;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public ShoppingPlanService(WardrobeItemRepository pieces, CatalogProductRepository products, ShoppingPlanDismissalRepository dismissals, CatalogService catalog, Guard guard) {
        this(pieces, products, dismissals, catalog, guard, Clock.systemUTC());
    }

    ShoppingPlanService(WardrobeItemRepository pieces, CatalogProductRepository products, ShoppingPlanDismissalRepository dismissals, CatalogService catalog, Guard guard, Clock clock) {
        this.pieces = pieces; this.products = products; this.dismissals = dismissals; this.catalog = catalog; this.guard = guard; this.clock = clock;
    }

    public Map<String, Object> plan(CurrentUser user, Request request) {
        guard.requireCanCreate(user);
        if (request == null || request.occasions() == null || request.occasions().isEmpty() || request.occasions().size() > 8) throw ApiException.badRequest("PLAN_OCCASIONS", "Informe de 1 a 8 ocasiões.");
        if (request.budget() == null || request.budget().signum() < 0 || request.currency() == null || !request.currency().matches("[A-Za-z]{3}")) throw ApiException.badRequest("PLAN_BUDGET", "Informe orçamento e moeda ISO.");
        String currency = request.currency().toUpperCase(Locale.ROOT);
        List<String> occasions = request.occasions().stream().map(o -> o.trim().toLowerCase(Locale.ROOT)).filter(o -> !o.isBlank()).distinct().toList();
        Set<String> excluded = request.excludedCategories() == null ? Set.of() : new LinkedHashSet<>(request.excludedCategories());
        // CA4 — só peças da própria pessoa; nada de terceiros entra como evidência.
        List<WardrobeItem> wardrobe = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED && w.isDisponivel()).toList();
        Coverage coverage = coverage(wardrobe, occasions, excluded);
        Map<UUID, String> dismissed = new LinkedHashMap<>();
        dismissals.findByUserId(user.id()).forEach(d -> dismissed.put(d.getProductId(), d.getKind()));
        List<Map<String, Object>> candidates = new ArrayList<>();
        BigDecimal guaranteed = BigDecimal.ZERO;
        int unconfirmed = 0;
        for (String slot : SLOTS) {
            Set<String> gapOccasions = coveredOccasions(coverage.gaps(), slot);
            if (gapOccasions.isEmpty()) continue;
            Map<String, Object> pick = null;
            for (CatalogProduct p : products.browse(null, slot, null, null, null, null, null, null, PageRequest.of(0, 24)).getContent()) {
                if (ShoppingPlanRules.dismissed(dismissed, p.getId())) continue;
                Price price = priceOf(p, currency);
                boolean affordable = price.confirmed() && guaranteed.add(price.amount()).compareTo(request.budget()) <= 0;
                Map<String, Object> candidate = candidate(p, slot, gapOccasions, price, wardrobe, affordable);
                if (pick == null || (affordable && !(Boolean) pick.get("withinBudget"))) pick = candidate;
                if (affordable) break;
            }
            if (pick == null) continue;
            candidates.add(pick);
            if ((Boolean) pick.get("withinBudget")) guaranteed = guaranteed.add((BigDecimal) pick.get("price")); else unconfirmed++;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("occasions", occasions);
        out.put("coverage", coverage.coveredBy());
        out.put("gaps", coverage.gaps());
        out.put("candidates", candidates);
        out.put("budget", request.budget());
        out.put("currency", currency);
        out.put("guaranteedTotal", guaranteed);
        out.put("remainingBudget", request.budget().subtract(guaranteed));
        out.put("outsideGuaranteedTotal", unconfirmed);
        out.put("computedAt", clock.instant());
        out.put("purchaseExecuted", false);
        out.put("evidenceScope", "OWN_WARDROBE_ONLY");
        return out;
    }

    private Map<String, Object> candidate(CatalogProduct p, String slot, Set<String> occasions, Price price, List<WardrobeItem> wardrobe, boolean withinBudget) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("product", catalog.product(p.getId()));
        out.put("slot", slot);
        out.put("coversOccasions", List.copyOf(occasions));
        out.put("complements", complements(wardrobe, slot, occasions).stream().limit(6).map(w -> Map.of("id", w.getId(), "name", w.getName(), "category", w.getCategory())).toList());
        out.put("price", price.amount());
        out.put("currency", price.currency());
        out.put("priceSource", price.source());
        out.put("priceCheckedAt", price.checkedAt());
        out.put("priceConfirmed", price.confirmed());
        out.put("withinBudget", withinBudget);
        out.put("reason", "FILLS_GAP");
        return out;
    }

    @Transactional
    public Map<String, Object> dismiss(CurrentUser user, UUID productId, String kind) {
        guard.requireCanCreate(user);
        String k = kind == null ? "" : kind.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("OWNED", "NOT_NEEDED").contains(k)) throw ApiException.badRequest("PLAN_DISMISSAL", "Use OWNED ou NOT_NEEDED.");
        products.findById(productId).orElseThrow(() -> ApiException.notFound("Produto"));
        ShoppingPlanDismissal d = dismissals.findByUserIdAndProductId(user.id(), productId).orElseGet(() -> { var fresh = new ShoppingPlanDismissal(); fresh.setUserId(user.id()); fresh.setProductId(productId); return fresh; });
        d.setKind(k);
        dismissals.saveAndFlush(d);
        return Map.of("productId", productId, "kind", k);
    }

    @Transactional
    public void undismiss(CurrentUser user, UUID productId) {
        guard.requireCanCreate(user);
        dismissals.findByUserIdAndProductId(user.id(), productId).ifPresent(dismissals::delete);
    }

    public List<Map<String, Object>> dismissed(CurrentUser user) {
        guard.requireCanCreate(user);
        return dismissals.findByUserId(user.id()).stream().map(d -> Map.<String, Object>of("productId", d.getProductId(), "kind", d.getKind())).toList();
    }
}
