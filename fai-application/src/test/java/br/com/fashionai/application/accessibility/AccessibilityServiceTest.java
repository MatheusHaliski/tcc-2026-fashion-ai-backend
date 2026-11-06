package br.com.fashionai.application.accessibility;

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

import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** RF-PESQ-08 — busca por acessibilidade de uso e conforto verificável. */
@SuppressWarnings("unchecked")
class AccessibilityServiceTest {
    CatalogAccessibilityAttributesRepository attributes = MemoryRepository.of(CatalogAccessibilityAttributesRepository.class);
    CatalogProductRepository products = MemoryRepository.of(CatalogProductRepository.class);
    BrandRepository brands = mock(BrandRepository.class);
    CatalogService catalog = mock(CatalogService.class);
    Guard guard = mock(Guard.class);
    AccessibilityService service;
    UUID brandId = UUID.randomUUID(), otherBrand = UUID.randomUUID();
    CurrentUser brand = new CurrentUser(UUID.randomUUID(), "marca", "USER", ProfileType.MARCA, true, AccountStatus.ACTIVE, null, null);
    CurrentUser admin = new CurrentUser(UUID.randomUUID(), "adm", "ADMIN", ProfileType.ADMIN, true, AccountStatus.ACTIVE, null, null);
    CatalogProduct shirt, foreign, blank;
    CatalogProduct product(String name, UUID brand) { CatalogProduct p = new CatalogProduct(); p.setProductName(name); p.setCategory("upper_piece"); p.setBrandId(brand); p.setMaterial("Linho"); return products.save(p); }
    AccessibilityService.Declaration declaration(String closure, String opening, String magnetic, String tagless, String contact) { return new AccessibilityService.Declaration("PHYSICAL_SAMPLE", closure, opening, magnetic, tagless, "UNKNOWN", contact, "UNKNOWN", "abertura total na frente", null); }

    @BeforeEach void setUp() {
        Brand b = new Brand(); b.assignId(brandId);
        when(brands.findByBrandProfile_Owner_Id(brand.id())).thenReturn(Optional.of(b));
        when(catalog.product(any())).thenAnswer(inv -> Map.of("id", inv.getArgument(0)));
        service = new AccessibilityService(attributes, products, brands, catalog, guard, Clock.fixed(Instant.parse("2026-11-05T12:00:00Z"), ZoneOffset.UTC));
        shirt = product("Camisa", brandId); foreign = product("Blusa", otherBrand); blank = product("Camiseta sem dados", brandId);
    }

    @Test void onlyTheOwningBrandDeclaresWithASourceAndNothingIsInferred() {
        assertThatThrownBy(() -> service.declare(brand, foreign.getId(), declaration("MAGNETIC", "FRONT", "TRUE", "TRUE", "SOFT"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThatThrownBy(() -> service.declare(brand, shirt.getId(), new AccessibilityService.Declaration(null, "MAGNETIC", "FRONT", "TRUE", "TRUE", "UNKNOWN", "SOFT", "UNKNOWN", null, null))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACCESSIBILITY_SOURCE"));
        assertThatThrownBy(() -> service.declare(brand, shirt.getId(), declaration("LASER", "FRONT", "TRUE", "TRUE", "SOFT"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACCESSIBILITY_VALUE"));
        var declared = service.declare(brand, shirt.getId(), declaration("MAGNETIC", "FRONT", "TRUE", "TRUE", "SOFT"));
        assertThat(declared).containsEntry("status", "DECLARED").containsEntry("declarationSource", "PHYSICAL_SAMPLE").containsEntry("clinicalClaim", "NONE").containsEntry("validatedWithUsers", false);
        assertThat((List<String>) declared.get("descriptionKeys")).contains("opening.FRONT", "closure.MAGNETIC", "magnetic", "tagless", "contact.SOFT");
        assertThat(service.product(blank.getId())).containsEntry("status", "UNKNOWN");
        assertThat(Json.write(service.product(blank.getId()))).doesNotContain("Linho", "unsuitable");
    }

    @Test void searchSeparatesConfirmedFromUnknownAndNeverStoresPreferences() {
        service.declare(brand, shirt.getId(), declaration("MAGNETIC", "FRONT", "TRUE", "TRUE", "SOFT"));
        service.declare(brand, blank.getId(), declaration("UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN"));
        CatalogProduct zipper = product("Jaqueta", brandId); service.declare(brand, zipper.getId(), declaration("ZIPPER", "FRONT", "FALSE", "FALSE", "NEUTRAL"));
        var out = service.search(new AccessibilityRules.Filters(true, true, false, false, false, false, false), null, 24);
        @SuppressWarnings("unchecked") var results = (List<Map<String, Object>>) out.get("results");
        @SuppressWarnings("unchecked") var unknown = (List<Map<String, Object>>) out.get("withoutInformation");
        assertThat(results).hasSize(1);
        assertThat(((Map<?, ?>) results.getFirst().get("product")).get("id")).isEqualTo(shirt.getId());
        assertThat(unknown).hasSize(1);
        assertThat((List<String>) unknown.getFirst().get("unknownFilters")).containsExactly("easyClosure", "frontOpening");
        assertThat(out).containsEntry("notice", "NO_DATA_IS_NOT_UNSUITABLE").containsEntry("preferencesStored", false).containsEntry("withoutInformationCount", 1);
        assertThat(Json.write(out)).doesNotContain("diagnos", "health", "condition");
    }

    @Test void editorialReviewMarksReviewedAndABrandEditReturnsToDeclared() {
        service.declare(brand, shirt.getId(), declaration("MAGNETIC", "FRONT", "TRUE", "TRUE", "SOFT"));
        doThrow(ApiException.forbidden("admin only")).when(guard).requireAdmin(brand);
        assertThatThrownBy(() -> service.review(brand, shirt.getId())).isInstanceOf(ApiException.class);
        var reviewed = service.review(admin, shirt.getId());
        assertThat(reviewed).containsEntry("status", "REVIEWED");
        assertThat(reviewed.get("reviewedAt")).isNotNull();
        var edited = service.declare(brand, shirt.getId(), declaration("MAGNETIC", "FRONT", "TRUE", "FALSE", "SOFT"));
        assertThat(edited).containsEntry("status", "DECLARED");
        assertThat(edited.get("reviewedAt")).isNull();
        assertThat(service.mine(brand)).hasSize(1);
    }
}
