package br.com.fashionai.application.passport;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.model.passport.*;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.passport.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

import static br.com.fashionai.application.passport.RepairOrderViews.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF-PESQ-05 — ordem de reparo com evidência emitida pela oficina. */
class RepairOrderServiceTest {
    PassportRepairOrderRepository orders = MemoryRepository.of(PassportRepairOrderRepository.class);
    PassportRepairOrderEventRepository events = MemoryRepository.of(PassportRepairOrderEventRepository.class);
    PassportRepairReceiptRepository receipts = MemoryRepository.of(PassportRepairReceiptRepository.class);
    GarmentPassportRepository passports = MemoryRepository.of(GarmentPassportRepository.class);
    PassportEventRepository passportEvents = MemoryRepository.of(PassportEventRepository.class);
    PassportShareRepository shares = MemoryRepository.of(PassportShareRepository.class);
    WardrobeItemRepository pieces = MemoryRepository.of(WardrobeItemRepository.class);
    UserRepository users = MemoryRepository.of(UserRepository.class);
    Guard guard = mock(Guard.class);
    Clock clock = Clock.fixed(Instant.parse("2026-11-05T12:00:00Z"), ZoneOffset.UTC);
    RepairOrderService service;
    GarmentPassportService passportService;
    User owner, tailor, stranger;
    GarmentPassport passport;
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }
    User person(String name) { User u = new User(name, name, name + "@x.invalid", "h" + name, "p", ProfileType.PESSOAL); u.setStatus(AccountStatus.ACTIVE); u.setEmailVerified(true); return users.save(u); }
    static byte[] photo() throws Exception { ByteArrayOutputStream out = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), "png", out); return out.toByteArray(); }
    long v(UUID id) { return orders.findById(id).orElseThrow().getVersion(); }

    @BeforeEach void setUp() {
        when(orders.lockById(any())).thenAnswer(inv -> orders.findById(inv.getArgument(0)));
        when(passports.lockById(any())).thenAnswer(inv -> passports.findById(inv.getArgument(0)));
        service = new RepairOrderService(orders, events, receipts, passports, passportEvents, users, guard, clock);
        passportService = new GarmentPassportService(passports, MemoryRepository.of(PassportHoldingRepository.class), passportEvents, shares, MemoryRepository.of(PassportEvidenceRepository.class),
                MemoryRepository.of(PassportTransferRepository.class), pieces, users, guard, mock(ApplicationEventPublisher.class), mock(br.com.fashionai.application.assets.AssetCatalogService.class), true, clock);
        owner = person("ana"); tailor = person("oficina"); stranger = person("bia");
        WardrobeItem piece = new WardrobeItem(); piece.setUser(owner); piece.setName("Casaco"); piece.setCategory("upper_piece"); piece.setImageOrigin(ImageOrigin.USER_PHOTO); pieces.save(piece);
        passport = new GarmentPassport(); passport.setPieceId(piece.getId()); passport.setOwnerId(owner.getId()); passport.setOrigin("COMPRADA"); passport.setStateUpdatedAt(clock.instant()); passports.save(passport);
    }
    Map<String, Object> request() { return service.request(actor(owner), passport.getId(), new RequestCmd("oficina", "Trocar zíper", "repair_00001")); }
    QuoteCmd quote(long version) { return new QuoteCmd(version, "Zíper 60 cm", new BigDecimal("80.00"), "BRL", LocalDate.of(2026, 11, 30)); }

    @Test void orderFollowsTheStateMachineAndOnlyTheOwnerAuthorizes() {
        var created = request(); UUID id = (UUID) created.get("id");
        assertThat(request().get("id")).isEqualTo(id);
        assertThatThrownBy(() -> service.request(actor(stranger), passport.getId(), new RequestCmd("oficina", null, "repair_00002"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThatThrownBy(() -> service.authorize(actor(owner), id, new VersionCmd(v(id)))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("REPAIR_TRANSITION"));
        assertThatThrownBy(() -> service.quote(actor(owner), id, quote(v(id)))).isInstanceOf(ApiException.class);
        var quoted = service.quote(actor(tailor), id, quote(v(id)));
        assertThat(quoted).containsEntry("status", "QUOTED").containsEntry("quoteAmount", new BigDecimal("80.00"));
        assertThatThrownBy(() -> service.authorize(actor(tailor), id, new VersionCmd(v(id)))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThatThrownBy(() -> service.authorize(actor(stranger), id, new VersionCmd(v(id)))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        var authorized = service.authorize(actor(owner), id, new VersionCmd(v(id)));
        assertThat(authorized).containsEntry("status", "AUTHORIZED").containsEntry("authorizedBy", owner.getId());
        service.start(actor(tailor), id, new VersionCmd(v(id)));
        var delivered = service.deliver(actor(tailor), id, new DeliverCmd(v(id), "Zíper trocado", "Serviço realizado conforme orçamento", "HISTORY_ONLY"));
        assertThat(delivered).containsEntry("status", "DELIVERED").containsEntry("attestation", "PROVIDER_DECLARED").containsEntry("authenticity", "NOT_CERTIFIED").containsEntry("environmentalClaim", "NONE");
        @SuppressWarnings("unchecked") var trail = (List<Map<String, Object>>) delivered.get("events");
        assertThat(trail).extracting(e -> e.get("toStatus")).containsExactly("REQUESTED", "QUOTED", "AUTHORIZED", "IN_SERVICE", "DELIVERED");
    }

    @Test void deliveryWritesOneProviderDeclaredRepairEventWithoutTouchingThePublicQr() throws Exception {
        var created = request(); UUID id = (UUID) created.get("id");
        service.quote(actor(tailor), id, quote(v(id))); service.authorize(actor(owner), id, new VersionCmd(v(id))); service.start(actor(tailor), id, new VersionCmd(v(id)));
        service.deliver(actor(tailor), id, new DeliverCmd(v(id), "Zíper trocado", "Feito", "PRIVATE"));
        var receipt = service.uploadReceipt(actor(tailor), id, photo(), "receipt_0001");
        assertThat(service.uploadReceipt(actor(tailor), id, photo(), "receipt_0001").get("id")).isEqualTo(receipt.get("id"));
        assertThat(MemoryRepository.<PassportEvent>rows(passportEvents)).hasSize(1);
        PassportEvent e = MemoryRepository.<PassportEvent>rows(passportEvents).getFirst();
        assertThat(e.getKind()).isEqualTo("REPAIR"); assertThat(e.getNotes()).contains("PROVIDER_DECLARED");
        var shared = passportService.share(actor(owner), passport.getId(), new GarmentPassportService.ShareCommand(passport.getVersion(), Set.of("HISTORY"), 24));
        String publicJson = Json.write(passportService.publicView(shared.token()));
        assertThat(publicJson).contains("REPAIR").doesNotContain("receipt", "Zíper", "oficina", tailor.getId().toString());
        assertThat(service.downloadReceipt(actor(owner), (UUID) receipt.get("id"))).isNotEmpty();
        assertThatThrownBy(() -> service.downloadReceipt(actor(stranger), (UUID) receipt.get("id"))).isInstanceOf(ApiException.class);
    }

    @Test void correctionsKeepHistoryAndRevocationBlocksTheProvider() {
        var created = request(); UUID id = (UUID) created.get("id");
        var quoted = service.quote(actor(tailor), id, quote(v(id)));
        @SuppressWarnings("unchecked") var trail = (List<Map<String, Object>>) quoted.get("events");
        UUID quoteEvent = (UUID) trail.get(1).get("id");
        assertThatThrownBy(() -> service.correct(actor(owner), id, new CorrectionCmd(quoteEvent, "não fui eu"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        var corrected = service.correct(actor(tailor), id, new CorrectionCmd(quoteEvent, "Zíper de 65 cm, não 60"));
        @SuppressWarnings("unchecked") var after = (List<Map<String, Object>>) corrected.get("events");
        assertThat(after).hasSize(3); assertThat(after.get(1)).containsEntry("notes", "Zíper 60 cm"); assertThat(after.get(2)).containsEntry("correctsEventId", quoteEvent);
        assertThat(service.providerInbox(actor(tailor))).hasSize(1);
        service.revokeAccess(actor(owner), id);
        assertThat(service.providerInbox(actor(tailor))).isEmpty();
        assertThatThrownBy(() -> service.get(actor(tailor), id)).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThatThrownBy(() -> service.quote(actor(tailor), id, quote(v(id)))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThat(service.forPassport(actor(owner), passport.getId())).hasSize(1);
    }
}
