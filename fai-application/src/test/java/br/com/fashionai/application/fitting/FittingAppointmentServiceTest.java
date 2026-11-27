package br.com.fashionai.application.fitting;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.fitting.FittingAppointment;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.domain.repository.fitting.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.*;

import static br.com.fashionai.application.fitting.FittingAppointmentViews.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF-PESQ-07 — prova física agendada com seleção de tamanhos e reserva temporária. */
class FittingAppointmentServiceTest {
    FittingAppointmentRepository appointments = MemoryRepository.of(FittingAppointmentRepository.class);
    FittingAppointmentItemRepository items = MemoryRepository.of(FittingAppointmentItemRepository.class);
    PhysicalStoreListingRepository listings = MemoryRepository.of(PhysicalStoreListingRepository.class);
    PhysicalStoreVariantRepository variants = MemoryRepository.of(PhysicalStoreVariantRepository.class);
    CatalogProductRepository products = MemoryRepository.of(CatalogProductRepository.class);
    UserRepository users = MemoryRepository.of(UserRepository.class);
    Instant now = Instant.parse("2026-11-05T12:00:00Z");
    FittingAppointmentService service;
    User customer, store;
    CatalogProduct jacket, hat;
    PhysicalStoreVariant m, g;
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }
    long v(UUID id) { return appointments.findById(id).orElseThrow().getVersion(); }

    @BeforeEach void setUp() {
        when(appointments.lockById(any())).thenAnswer(inv -> appointments.findById(inv.getArgument(0)));
        when(variants.lockById(any())).thenAnswer(inv -> variants.findById(inv.getArgument(0)));
        when(listings.findActiveBySellerAndProduct(any(), any())).thenAnswer(inv -> MemoryRepository.<PhysicalStoreListing>rows(listings).stream()
                .filter(l -> l.getSellerUserId().equals(inv.getArgument(0)) && l.getProduct().getId().equals(inv.getArgument(1)) && l.isActive()).toList());
        service = new FittingAppointmentService(appointments, items, listings, variants, products, users, mock(Guard.class), Clock.fixed(now, ZoneOffset.UTC));
        customer = new User("ana", "Ana", "a@x.invalid", "h1", "p", ProfileType.PESSOAL); customer.setStatus(AccountStatus.ACTIVE); users.save(customer);
        store = new User("loja", "Loja", "l@x.invalid", "h2", "p", ProfileType.MARCA); store.setStatus(AccountStatus.ACTIVE); users.save(store);
        jacket = new CatalogProduct(); jacket.setProductName("Jaqueta"); jacket.setCategory("upper_piece"); products.save(jacket);
        hat = new CatalogProduct(); hat.setProductName("Chapéu"); hat.setCategory("accessory_piece"); products.save(hat);
        PhysicalStoreListing listing = new PhysicalStoreListing(); listing.setProduct(jacket); listing.setSellerUserId(store.getId()); listing.setPricePoints(10); listing.setActive(true); listings.save(listing);
        m = new PhysicalStoreVariant(); m.setListingId(listing.getId()); m.setVariantKey("azul|m"); m.setSizeLabel("M"); m.setColorName("Azul"); m.setStockQuantity(1); variants.save(m);
        g = new PhysicalStoreVariant(); g.setListingId(listing.getId()); g.setVariantKey("azul|g"); g.setSizeLabel("G"); g.setColorName("Azul"); g.setStockQuantity(0); variants.save(g);
    }
    RequestCmd cmd(String key) { return new RequestCmd("loja", now.plus(Duration.ofDays(1)), List.of(new ItemCmd(jacket.getId(), "M", null), new ItemCmd(jacket.getId(), "G", null), new ItemCmd(hat.getId(), "U", null)), "oi", key); }

    @Test void reservationOnlyWithStockOtherItemsStayPendingAndNothingPrivateGoesToTheStore() {
        var created = service.request(actor(customer), cmd("fit-00000001"));
        assertThat(service.request(actor(customer), cmd("fit-00000001")).get("id")).isEqualTo(created.get("id"));
        assertThat(created).containsEntry("status", "REQUESTED").containsEntry("confirmation", "PENDING_STORE").containsEntry("reservationsActive", true);
        @SuppressWarnings("unchecked") var rows = (List<Map<String, Object>>) created.get("items");
        assertThat(rows).extracting(r -> r.get("state")).containsExactly("RESERVED", "UNAVAILABLE", "NO_INTEGRATION");
        assertThat(m.getReservedQuantity()).isEqualTo(1); assertThat(m.available()).isZero();
        String storeJson = Json.write(service.storeInbox(actor(store)));
        assertThat(storeJson).contains("Jaqueta", "\"M\"").doesNotContain("measure", "avatar", "photo", "height", "chest");
        assertThat(service.storeInbox(actor(store)).getFirst()).containsEntry("role", "STORE");
        assertThatThrownBy(() -> service.request(actor(customer), new RequestCmd("loja", now.minusSeconds(1), List.of(new ItemCmd(jacket.getId(), "M", null)), null, "fit-00000002"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("FITTING_INVALID"));
    }

    @Test void storeConfirmationIsRequiredAndCancellationReleasesOnce() {
        UUID id = (UUID) service.request(actor(customer), cmd("fit-00000001")).get("id");
        assertThatThrownBy(() -> service.confirm(actor(customer), id, new ConfirmCmd(v(id), now.plus(Duration.ofDays(1))))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        var confirmed = service.confirm(actor(store), id, new ConfirmCmd(v(id), now.plus(Duration.ofDays(1))));
        assertThat(confirmed).containsEntry("status", "CONFIRMED").containsEntry("confirmation", "STORE_CONFIRMED");
        var cancelled = service.cancel(actor(customer), id, new VersionCmd(v(id)));
        assertThat(cancelled).containsEntry("status", "CANCELLED").containsEntry("reservationsActive", false);
        assertThat(m.getReservedQuantity()).isZero();
        assertThat(service.cancel(actor(customer), id, new VersionCmd(999))).containsEntry("status", "CANCELLED");
        assertThat(m.getReservedQuantity()).isZero();
    }

    @Test void expiryIsIdempotentAndCompletionReconcilesWithoutPublishing() {
        UUID id = (UUID) service.request(actor(customer), cmd("fit-00000001")).get("id");
        FittingAppointment a = appointments.findById(id).orElseThrow(); a.setExpiresAt(now.minusSeconds(1)); appointments.save(a);
        assertThat(service.mine(actor(customer)).getFirst()).containsEntry("status", "EXPIRED").containsEntry("reservationsActive", false);
        service.expire(); service.expire();
        assertThat(a.getStatus()).isEqualTo("EXPIRED"); assertThat(m.getReservedQuantity()).isZero();
        UUID second = (UUID) service.request(actor(customer), cmd("fit-00000002")).get("id");
        service.confirm(actor(store), second, new ConfirmCmd(v(second), now.plus(Duration.ofDays(1))));
        @SuppressWarnings("unchecked") var rows = (List<Map<String, Object>>) service.mine(actor(customer)).stream().filter(x -> x.get("id").equals(second)).findFirst().orElseThrow().get("items");
        var done = service.complete(actor(customer), second, new CompleteCmd(v(second), List.of(new ResultCmd((UUID) rows.getFirst().get("id"), "FIT"))));
        assertThat(done).containsEntry("status", "COMPLETED");
        @SuppressWarnings("unchecked") var results = (List<Map<String, Object>>) done.get("items");
        assertThat(results).extracting(r -> r.get("result")).containsExactly("FIT", "NOT_TRIED", "NOT_TRIED");
        assertThat(m.getReservedQuantity()).isZero();
        assertThat(Json.write(done)).doesNotContain("hype", "feed", "social", "published");
    }
}
