package br.com.fashionai.application.demand;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.PhysicalStoreReturnEvents;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF-PESQ-10 — painel de demanda de varejo agregado e consentido. */
@SuppressWarnings("unchecked")
class RetailDemandServiceTest {
    RetailDemandEventRepository events = MemoryRepository.of(RetailDemandEventRepository.class);
    UserConsentRepository consents = MemoryRepository.of(UserConsentRepository.class);
    CatalogProductRepository products = MemoryRepository.of(CatalogProductRepository.class);
    PhysicalStoreVariantRepository variants = MemoryRepository.of(PhysicalStoreVariantRepository.class);
    BrandRepository brands = mock(BrandRepository.class);
    Instant now = Instant.parse("2026-11-05T12:00:00Z");
    RetailDemandService service;
    UUID brandId = UUID.randomUUID();
    CurrentUser seller = new CurrentUser(UUID.randomUUID(), "marca", "USER", ProfileType.MARCA, true, AccountStatus.ACTIVE, null, null);
    CatalogProduct jacket, otherBrandProduct;
    List<User> people = new ArrayList<>();
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }
    User person(boolean granted) {
        User u = new User("u" + people.size(), "U", "u" + people.size() + "@x.invalid", "h" + people.size(), "p", ProfileType.PESSOAL); u.setStatus(AccountStatus.ACTIVE); u.setEmailVerified(true); u.assignId(UUID.randomUUID());
        UserConsent c = new UserConsent(u, ConsentPurpose.RETAIL_DEMAND_ANALYTICS, "Consentimento", "v1"); c.setGranted(granted); consents.save(c);
        people.add(u); return u;
    }

    @BeforeEach void setUp() {
        Brand b = new Brand(); b.assignId(brandId); when(brands.findByBrandProfile_Owner_Id(seller.id())).thenReturn(Optional.of(b));
        service = new RetailDemandService(events, consents, products, variants, brands, mock(Guard.class), 3, "secret", Clock.fixed(now, ZoneOffset.UTC));
        jacket = new CatalogProduct(); jacket.setProductName("Jaqueta"); jacket.setBrandId(brandId); jacket.setCategory("upper_piece"); products.save(jacket);
        otherBrandProduct = new CatalogProduct(); otherBrandProduct.setProductName("Outra"); otherBrandProduct.setBrandId(UUID.randomUUID()); products.save(otherBrandProduct);
    }
    Map<String, Object> interest(User u, String size, String kind) { return service.record(actor(u), new RetailDemandService.EventCmd(jacket.getId(), null, size, kind)); }

    @Test void contributionIsOptionalExplicitDeduplicatedAndStoresNoIdentity() {
        User yes = person(true), no = person(false);
        assertThat(interest(no, "M", "INTEREST")).containsEntry("recorded", false).containsEntry("reason", "NO_CONSENT");
        assertThat(interest(yes, "M", "UNAVAILABLE")).containsEntry("recorded", true).containsEntry("identityStored", false);
        assertThat(interest(yes, "M", "UNAVAILABLE")).containsEntry("recorded", false);
        RetailDemandEvent stored = MemoryRepository.<RetailDemandEvent>rows(events).getFirst();
        assertThat(Json.write(stored)).doesNotContain(yes.getId().toString(), yes.getUsername(), "@x.invalid");
        assertThat(stored.getContributorHash()).hasSize(64).isEqualTo(service.hash(yes.getId()));
        assertThat(service.myStatus(actor(yes))).containsEntry("granted", true).containsEntry("contributions", 1L);
        assertThat(service.purgeContributions(yes.getId())).containsEntry("deleted", 1);
        assertThat(MemoryRepository.rows(events)).isEmpty();
    }

    @Test void panelAppliesThresholdSuppressesSmallRemaindersAndShowsOnlyOwnCatalog() {
        for (int i = 0; i < 4; i++) interest(person(true), "M", "UNAVAILABLE");
        interest(person(true), "G", "UNAVAILABLE");
        for (int i = 0; i < 3; i++) interest(person(true), "P", "INTEREST");
        User foreign = person(true);
        service.record(actor(foreign), new RetailDemandService.EventCmd(otherBrandProduct.getId(), null, "M", "INTEREST"));
        for (RetailDemandEvent e : MemoryRepository.<RetailDemandEvent>rows(events)) e.setBucketDay(LocalDate.of(2026, 11, 3));
        var panel = service.panel(seller, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 5));
        var cells = (List<Map<String, Object>>) panel.get("cells");
        // M=4, P=3, G=1: G fica abaixo do limiar e, como o resto (1 pessoa) exporia um grupo pequeno, P também é suprimido.
        assertThat(cells).extracting(c -> c.get("sizeLabel")).containsExactly("M");
        assertThat(cells).allSatisfy(c -> assertThat(c).doesNotContainKeys("contributorHash", "userId", "username"));
        assertThat(panel).containsEntry("suppressedCells", 2).containsEntry("threshold", 3).containsEntry("delayDays", 1).containsEntry("scope", "OWN_CATALOG_ONLY").containsEntry("notice", "AGGREGATED_CONSENTED_NOT_A_FORECAST");
        assertThat(panel).containsEntry("contributors", 8L).containsEntry("sampleSize", 8L);
        assertThat(((Map<?, ?>) panel.get("period")).get("to")).isEqualTo(LocalDate.of(2026, 11, 4));
        assertThat(Json.write(panel)).doesNotContain("Outra");
        people.get(0).getId();
        UserConsent revoked = consents.findByUserIdAndPurpose(people.get(0).getId(), ConsentPurpose.RETAIL_DEMAND_ANALYTICS).orElseThrow(); revoked.setGranted(false); consents.save(revoked);
        var after = (List<Map<String, Object>>) service.panel(seller, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 5)).get("cells");
        assertThat(after).hasSize(1);
        assertThat(after.getFirst()).containsEntry("contributors", 3L);
    }

    @Test void complementarySuppressionHidesACellWhoseRemainderWouldExposeAFewPeople() {
        for (int i = 0; i < 3; i++) interest(person(true), "M", "INTEREST");
        interest(person(true), "G", "INTEREST");
        for (RetailDemandEvent e : MemoryRepository.<RetailDemandEvent>rows(events)) e.setBucketDay(LocalDate.of(2026, 11, 3));
        var panel = service.panel(seller, null, null);
        assertThat((List<?>) panel.get("cells")).isEmpty();
        assertThat(panel).containsEntry("suppressedCells", 2);
        User fit = person(true);
        service.onFitFeedback(new PhysicalStoreReturnEvents.FitFeedbackRecorded(seller.id(), jacket.getId(), null, "M", "FIT_TOO_SMALL", fit.getId()));
        service.onFitFeedback(new PhysicalStoreReturnEvents.FitFeedbackRecorded(seller.id(), jacket.getId(), null, "M", "FIT_TOO_SMALL", person(false).getId()));
        assertThat(MemoryRepository.<RetailDemandEvent>rows(events).stream().filter(e -> "SIZE_MISMATCH".equals(e.getKind()))).hasSize(1);
    }
}
