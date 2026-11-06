package br.com.fashionai.application.shopping;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** RF-PESQ-09 — lista de compras por lacunas e orçamento do guarda-roupa. */
@SuppressWarnings("unchecked")
class ShoppingPlanServiceTest {
    WardrobeItemRepository pieces = MemoryRepository.of(WardrobeItemRepository.class);
    CatalogProductRepository products = mock(CatalogProductRepository.class);
    ShoppingPlanDismissalRepository dismissals = MemoryRepository.of(ShoppingPlanDismissalRepository.class);
    CatalogService catalog = mock(CatalogService.class);
    Instant now = Instant.parse("2026-11-05T12:00:00Z");
    ShoppingPlanService service;
    User ana, bia;
    CatalogProduct jeans, cheapJeans, boots;
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }
    WardrobeItem piece(User owner, String name, String category, String occasions) { WardrobeItem w = new WardrobeItem(); w.setUser(owner); w.setName(name); w.setCategory(category); w.setOccasionTags(occasions); return pieces.save(w); }
    CatalogProduct product(String name, String category, BigDecimal price, String currency, Instant checked) { CatalogProduct p = new CatalogProduct(); p.assignId(UUID.randomUUID()); p.setProductName(name); p.setCategory(category); p.setListPrice(price); p.setPriceCurrency(currency); p.setPriceCheckedAt(checked); p.setPriceSource("brand.example"); return p; }

    @BeforeEach void setUp() {
        ana = new User("ana", "Ana", "a@x.invalid", "h1", "p", ProfileType.PESSOAL); ana.setStatus(AccountStatus.ACTIVE); ana.assignId(UUID.randomUUID());
        bia = new User("bia", "Bia", "b@x.invalid", "h2", "p", ProfileType.PESSOAL); bia.setStatus(AccountStatus.ACTIVE); bia.assignId(UUID.randomUUID());
        piece(ana, "Camisa social", "upper_piece", "trabalho,festa"); piece(ana, "Tênis", "shoes_piece", "trabalho");
        piece(bia, "Calça da Bia", "lower_piece", "trabalho");
        jeans = product("Calça alfaiataria", "lower_piece", new BigDecimal("300.00"), "BRL", now.minusSeconds(3600));
        cheapJeans = product("Calça básica", "lower_piece", new BigDecimal("120.00"), "BRL", now.minusSeconds(3600));
        boots = product("Sapato", "shoes_piece", null, null, null);
        when(products.browse(any(), eq("lower_piece"), any(), any(), any(), any(), any(), any(), any())).thenReturn(new PageImpl<>(List.of(jeans, cheapJeans)));
        when(products.browse(any(), eq("shoes_piece"), any(), any(), any(), any(), any(), any(), any())).thenReturn(new PageImpl<>(List.of(boots)));
        when(products.browse(any(), eq("upper_piece"), any(), any(), any(), any(), any(), any(), any())).thenReturn(new PageImpl<>(List.of()));
        when(products.findById(any())).thenAnswer(inv -> Optional.of(jeans));
        when(catalog.product(any())).thenAnswer(inv -> Map.of("id", inv.getArgument(0)));
        service = new ShoppingPlanService(pieces, products, dismissals, catalog, mock(Guard.class), Clock.fixed(now, ZoneOffset.UTC));
    }
    ShoppingPlanService.Request request(BigDecimal budget) { return new ShoppingPlanService.Request(List.of("trabalho", "festa"), budget, "BRL", List.of()); }

    @Test void gapsPerOccasionUseOnlyMyWardrobeAndCandidatesExplainWhatTheyComplement() {
        var plan = service.plan(actor(ana), request(new BigDecimal("500")));
        var gaps = (List<ShoppingPlanRules.Gap>) plan.get("gaps");
        assertThat(gaps).containsExactly(new ShoppingPlanRules.Gap("trabalho", "lower_piece"), new ShoppingPlanRules.Gap("festa", "lower_piece"), new ShoppingPlanRules.Gap("festa", "shoes_piece"));
        var candidates = (List<Map<String, Object>>) plan.get("candidates");
        assertThat(candidates).hasSize(2);
        var lower = candidates.getFirst();
        assertThat((List<String>) lower.get("coversOccasions")).containsExactly("trabalho", "festa");
        var complements = (List<Map<String, Object>>) lower.get("complements");
        assertThat(complements).extracting(c -> c.get("name")).containsExactlyInAnyOrder("Camisa social", "Tênis");
        assertThat(Json.write(plan)).doesNotContain("Calça da Bia", bia.getId().toString());
        assertThat(plan).containsEntry("purchaseExecuted", false).containsEntry("evidenceScope", "OWN_WARDROBE_ONLY");
    }

    @Test void onlyConfirmedPricesEnterTheGuaranteedTotalAndBudgetIsRespected() {
        var plan = service.plan(actor(ana), request(new BigDecimal("200")));
        var candidates = (List<Map<String, Object>>) plan.get("candidates");
        var lower = candidates.getFirst();
        assertThat(((Map<?, ?>) lower.get("product")).get("id")).isEqualTo(cheapJeans.getId());
        assertThat(lower).containsEntry("priceConfirmed", true).containsEntry("withinBudget", true).containsEntry("currency", "BRL").containsEntry("priceSource", "brand.example");
        assertThat(lower.get("priceCheckedAt")).isEqualTo(now.minusSeconds(3600));
        var shoes = candidates.get(1);
        assertThat(shoes).containsEntry("priceConfirmed", false).containsEntry("withinBudget", false);
        assertThat(plan).containsEntry("guaranteedTotal", new BigDecimal("120.00")).containsEntry("outsideGuaranteedTotal", 1).containsEntry("remainingBudget", new BigDecimal("80.00"));
        assertThatThrownBy(() -> service.plan(actor(ana), new ShoppingPlanService.Request(List.of("trabalho"), new BigDecimal("10"), "R$", List.of()))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("PLAN_BUDGET"));
    }

    @Test void dismissedProductsAreNotSuggestedAgainAfterRecalculation() {
        service.dismiss(actor(ana), cheapJeans.getId(), "owned");
        assertThatThrownBy(() -> service.dismiss(actor(ana), jeans.getId(), "later")).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("PLAN_DISMISSAL"));
        var plan = service.plan(actor(ana), request(new BigDecimal("500")));
        var candidates = (List<Map<String, Object>>) plan.get("candidates");
        assertThat(((Map<?, ?>) candidates.getFirst().get("product")).get("id")).isEqualTo(jeans.getId());
        assertThat(service.dismissed(actor(ana))).hasSize(1);
        assertThat(service.dismissed(actor(bia))).isEmpty();
        service.undismiss(actor(ana), cheapJeans.getId());
        assertThat(service.dismissed(actor(ana))).isEmpty();
    }
}
