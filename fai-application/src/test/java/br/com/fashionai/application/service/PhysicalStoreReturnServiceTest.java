package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.store.PhysicalStoreReturnCase;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.domain.repository.store.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** RF-PESQ-02 — troca/devolução rastreável e estorno único de FAI Points. */
class PhysicalStoreReturnServiceTest {
    PhysicalStoreReturnCaseRepository cases = MemoryRepository.of(PhysicalStoreReturnCaseRepository.class);
    PhysicalStoreReturnEventRepository events = MemoryRepository.of(PhysicalStoreReturnEventRepository.class);
    PhysicalStoreReturnEvidenceRepository evidence = MemoryRepository.of(PhysicalStoreReturnEvidenceRepository.class);
    PhysicalStoreOrderRepository orders = MemoryRepository.of(PhysicalStoreOrderRepository.class);
    PhysicalStoreListingRepository listings = MemoryRepository.of(PhysicalStoreListingRepository.class);
    PhysicalStoreVariantRepository variants = MemoryRepository.of(PhysicalStoreVariantRepository.class);
    FaiPointsLedgerEntryRepository ledger = MemoryRepository.of(FaiPointsLedgerEntryRepository.class);
    Guard guard = mock(Guard.class);
    ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
    Instant now = Instant.parse("2026-11-05T12:00:00Z");
    PhysicalStoreReturnService service;
    UUID buyer = UUID.randomUUID(), seller = UUID.randomUUID(), stranger = UUID.randomUUID();
    PhysicalStoreListing listing; PhysicalStoreVariant m, g; PhysicalStoreOrder order;
    CurrentUser actor(UUID id, boolean admin) { return new CurrentUser(id, "u", admin ? "ADMIN" : "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null); }
    PhysicalStoreReturnService.Request ret(String reason) { return new PhysicalStoreReturnService.Request("RETURN", reason, "notes", null, false); }

    @BeforeEach void setUp() {
        when(cases.lockById(any())).thenAnswer(inv -> cases.findById(inv.getArgument(0)));
        when(variants.lockById(any())).thenAnswer(inv -> variants.findById(inv.getArgument(0)));
        when(listings.lockById(any())).thenAnswer(inv -> listings.findById(inv.getArgument(0)));
        when(ledger.existsByIdempotencyKey(any())).thenAnswer(inv -> MemoryRepository.<FaiPointsLedgerEntry>rows(ledger).stream().anyMatch(e -> e.getIdempotencyKey().equals(inv.getArgument(0))));
        service = new PhysicalStoreReturnService(cases, events, evidence, orders, listings, variants, ledger, guard, publisher, Clock.fixed(now, ZoneOffset.UTC));
        CatalogProduct product = new CatalogProduct(); product.assignId(UUID.randomUUID());
        listing = new PhysicalStoreListing(); listing.setProduct(product); listing.setSellerUserId(seller); listing.setPricePoints(120); listings.save(listing);
        m = new PhysicalStoreVariant(); m.setListingId(listing.getId()); m.setVariantKey("azul|m"); m.setSizeLabel("M"); m.setColorName("Azul"); m.setStockQuantity(0); variants.save(m);
        g = new PhysicalStoreVariant(); g.setListingId(listing.getId()); g.setVariantKey("azul|g"); g.setSizeLabel("G"); g.setColorName("Azul"); g.setStockQuantity(2); variants.save(g);
        order = new PhysicalStoreOrder(); order.setListing(listing); order.setBuyerUserId(buyer); order.setPricePoints(120); order.setShippingAddress("{}");
        order.setStatus("DELIVERED"); order.setDeliveredAt(now.minus(Duration.ofDays(2))); order.setVariantId(m.getId()); order.setVariantSize("M");
        PhysicalStoreReturnPolicy.current().attach(order); orders.save(order);
    }
    static byte[] photo() throws Exception { ByteArrayOutputStream out = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), "png", out); return out.toByteArray(); }

    @Test void eligibilityUsesThePolicyFrozenOnTheOrderNotTheCurrentOne() {
        order.setReturnWindowDays(1); order.setReturnPolicyVersion("RETURN_POLICY_OLD");
        var view = service.eligibility(actor(buyer, false), order.getId());
        assertThat(view).containsEntry("eligible", false).containsEntry("reason", "WINDOW_EXPIRED").containsEntry("policyVersion", "RETURN_POLICY_OLD").containsEntry("windowDays", 1);
        order.setReturnWindowDays(7);
        assertThat(service.eligibility(actor(buyer, false), order.getId())).containsEntry("eligible", true).containsEntry("deadlineAt", now.plus(Duration.ofDays(5)));
        order.setStatus("SHIPPED");
        assertThatThrownBy(() -> service.open(actor(buyer, false), order.getId(), ret("CHANGED_MIND"), "case_000001")).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("DEVOLUCAO_INELEGIVEL"));
    }

    @Test void onlyPartiesAccessTheCaseAndEvidenceStaysRestricted() throws Exception {
        var c = service.open(actor(buyer, false), order.getId(), ret("QUALITY_DEFECT"), "case_000001");
        UUID id = (UUID) c.get("id");
        assertThatThrownBy(() -> service.get(actor(stranger, false), id)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.eligibility(actor(stranger, false), order.getId())).isInstanceOf(ApiException.class);
        var doc = service.uploadEvidence(actor(buyer, false), id, photo(), "evidence_0001");
        assertThat(service.uploadEvidence(actor(buyer, false), id, photo(), "evidence_0001").get("id")).isEqualTo(doc.get("id"));
        assertThat(service.downloadEvidence(actor(seller, false), (UUID) doc.get("id"))).isNotEmpty();
        assertThatThrownBy(() -> service.downloadEvidence(actor(stranger, false), (UUID) doc.get("id"))).isInstanceOf(ApiException.class);
        assertThat(service.get(actor(seller, false), id)).containsEntry("role", "SELLER");
        assertThatThrownBy(() -> service.decide(actor(buyer, false), id, new PhysicalStoreReturnService.Decision(0, true, null))).isInstanceOf(ApiException.class);
    }

    @Test void refundIsPostedOnceAfterInspectionAndRestockIsExplicit() {
        var c = service.open(actor(buyer, false), order.getId(), ret("COLOR_DIFFERS"), "case_000001");
        UUID id = (UUID) c.get("id");
        assertThat(service.open(actor(buyer, false), order.getId(), ret("COLOR_DIFFERS"), "case_000001").get("id")).isEqualTo(id);
        assertThatThrownBy(() -> service.open(actor(buyer, false), order.getId(), ret("OTHER"), "case_000002")).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getMessage()).contains("caso aberto"));
        long v = (long) cases.findById(id).orElseThrow().getVersion();
        service.decide(actor(seller, false), id, new PhysicalStoreReturnService.Decision(v, true, "ok"));
        assertThatThrownBy(() -> service.inspect(actor(seller, false), id, new PhysicalStoreReturnService.Inspection(cases.findById(id).orElseThrow().getVersion(), "AS_DECLARED", null, true, true, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("TRANSICAO_INVALIDA"));
        service.ship(actor(buyer, false), id, new PhysicalStoreReturnService.Shipment(cases.findById(id).orElseThrow().getVersion(), "BR123"));
        service.receive(actor(seller, false), id, cases.findById(id).orElseThrow().getVersion());
        assertThat(MemoryRepository.rows(ledger)).isEmpty();
        assertThat(m.getStockQuantity()).isZero();
        var done = service.inspect(actor(seller, false), id, new PhysicalStoreReturnService.Inspection(cases.findById(id).orElseThrow().getVersion(), "AS_DECLARED", null, true, true, "ok"));
        assertThat(done).containsEntry("status", "REFUNDED").containsEntry("refunded", true).containsEntry("restocked", true);
        assertThat(MemoryRepository.<FaiPointsLedgerEntry>rows(ledger)).extracting(FaiPointsLedgerEntry::getDelta).containsExactly(120, -120);
        assertThat(m.getStockQuantity()).isEqualTo(1);
        assertThatThrownBy(() -> service.inspect(actor(seller, false), id, new PhysicalStoreReturnService.Inspection(cases.findById(id).orElseThrow().getVersion(), "AS_DECLARED", null, true, true, null))).isInstanceOf(ApiException.class);
        assertThat(MemoryRepository.rows(ledger)).hasSize(2);
        @SuppressWarnings("unchecked") var trail = (List<Map<String, Object>>) done.get("events");
        assertThat(trail).extracting(e -> e.get("toStatus")).containsExactly("REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED", "INSPECTED", "REFUNDED");
    }

    @Test void divergentInspectionNeedsAReasonAndCanCloseWithoutRefundOrRestock() {
        var c = service.open(actor(buyer, false), order.getId(), ret("WRONG_ITEM"), "case_000001");
        UUID id = (UUID) c.get("id");
        service.decide(actor(seller, false), id, new PhysicalStoreReturnService.Decision(cases.findById(id).orElseThrow().getVersion(), true, null));
        service.receive(actor(seller, false), id, cases.findById(id).orElseThrow().getVersion());
        assertThatThrownBy(() -> service.inspect(actor(seller, false), id, new PhysicalStoreReturnService.Inspection(cases.findById(id).orElseThrow().getVersion(), "DIVERGENT", null, false, false, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("DIVERGENCIA_SEM_MOTIVO"));
        var closed = service.inspect(actor(seller, false), id, new PhysicalStoreReturnService.Inspection(cases.findById(id).orElseThrow().getVersion(), "DIVERGENT", "Peça usada e sem etiqueta", false, false, null));
        assertThat(closed).containsEntry("status", "CLOSED").containsEntry("refunded", false).containsEntry("restocked", false).containsEntry("divergenceReason", "Peça usada e sem etiqueta");
        assertThat(MemoryRepository.rows(ledger)).isEmpty();
    }

    @Test void exchangeCreatesANewOrderFromAnAvailableVariantAndFitFeedbackNeedsConsent() {
        assertThatThrownBy(() -> service.open(actor(buyer, false), order.getId(), new PhysicalStoreReturnService.Request("EXCHANGE", "FIT_TOO_SMALL", null, m.getId(), false), "case_000001"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("VARIANTE_TROCA"));
        var c = service.open(actor(buyer, false), order.getId(), new PhysicalStoreReturnService.Request("EXCHANGE", "FIT_TOO_SMALL", null, g.getId(), false), "case_000002");
        verify(publisher, never()).publishEvent(any(PhysicalStoreReturnEvents.FitFeedbackRecorded.class));
        UUID id = (UUID) c.get("id");
        service.decide(actor(buyer.equals(seller) ? stranger : seller, false), id, new PhysicalStoreReturnService.Decision(cases.findById(id).orElseThrow().getVersion(), true, null));
        service.receive(actor(stranger, true), id, cases.findById(id).orElseThrow().getVersion());
        var done = service.inspect(actor(stranger, true), id, new PhysicalStoreReturnService.Inspection(cases.findById(id).orElseThrow().getVersion(), "AS_DECLARED", null, false, true, null));
        assertThat(done).containsEntry("status", "EXCHANGED");
        assertThat(done.get("exchangeOrderId")).isNotNull();
        PhysicalStoreOrder next = orders.findById((UUID) done.get("exchangeOrderId")).orElseThrow();
        assertThat(next.getPricePoints()).isZero(); assertThat(next.getVariantSize()).isEqualTo("G"); assertThat(g.getStockQuantity()).isEqualTo(1);
        assertThat(MemoryRepository.rows(ledger)).isEmpty();
        PhysicalStoreReturnCase stored = cases.findById(id).orElseThrow();
        assertThat(stored.isFitFeedbackConsent()).isFalse();
    }
}
