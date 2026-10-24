package br.com.fashionai.application.passport;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.model.passport.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.domain.repository.passport.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class GarmentPassportServiceTest {
    GarmentPassportRepository passports=MemoryRepository.of(GarmentPassportRepository.class);
    PassportHoldingRepository holdings=MemoryRepository.of(PassportHoldingRepository.class);
    PassportEventRepository events=MemoryRepository.of(PassportEventRepository.class);
    PassportShareRepository shares=MemoryRepository.of(PassportShareRepository.class);
    PassportEvidenceRepository evidence=MemoryRepository.of(PassportEvidenceRepository.class);
    PassportTransferRepository transfers=MemoryRepository.of(PassportTransferRepository.class);
    WardrobeItemRepository pieces=MemoryRepository.of(WardrobeItemRepository.class);
    UserRepository users=MemoryRepository.of(UserRepository.class);
    Guard guard=mock(Guard.class);
    ApplicationEventPublisher lifecycle=mock(ApplicationEventPublisher.class);
    Instant now=Instant.parse("2026-10-22T12:00:00Z");
    GarmentPassportService service;
    User ana, bia, other;
    WardrobeItem piece;
    CurrentUser actor(User user) { return CurrentUser.of(user,"127.0.0.1","test"); }
    User person(String name) {
        User user=new User(name,name,name+"@example.invalid",name+"_email_hash","password",ProfileType.PESSOAL);
        user.setStatus(AccountStatus.ACTIVE); user.setEmailVerified(true); return users.save(user);
    }
    @BeforeEach void setup() {
        when(passports.lockById(any())).thenAnswer(call->passports.findById(call.getArgument(0)));
        when(pieces.findForSealRequest(any())).thenAnswer(call->pieces.findById(call.getArgument(0)));
        when(transfers.lockById(any())).thenAnswer(call->transfers.findById(call.getArgument(0)));
        when(transfers.passportIdOf(any())).thenAnswer(call->transfers.findById(call.getArgument(0)).map(PassportTransfer::getPassportId));
        service=new GarmentPassportService(passports,holdings,events,shares,evidence,transfers,pieces,users,guard,lifecycle,true,Clock.fixed(now,ZoneOffset.UTC));
        ana=person("ana"); bia=person("bia"); other=person("other");
        piece=new WardrobeItem(); piece.setUser(ana); piece.setName("Jaqueta azul"); piece.setCategory("upper_piece"); piece.setSubcategory("jacket");
        piece.setColor("blue"); piece.setMaterial("Cotton"); piece.setCareInstructions("Cold wash"); piece.setImageUrl("/media/ana-private-photo.jpg");
        piece.setImageOrigin(ImageOrigin.USER_PHOTO); piece.setPurchaseLocation("PRIVATE SHOP ADDRESS"); piece.setNotes("PRIVATE ACCOUNT NOTES");
        piece.setSealIdsJson("[\"HYPE-SEAL\"]"); piece.setWearCount(7); pieces.save(piece);
    }
    GarmentPassportService.PrivateView create() { return service.create(actor(ana),piece.getId(),"create_0001"); }
    GarmentPassportService.TransferCreated offer(UUID id,String key) {
        return service.offerTransfer(actor(ana),id,new GarmentPassportService.TransferCommand(0,"bia",48),key);
    }
    static byte[] photo() throws Exception {
        ByteArrayOutputStream out=new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(8,8,BufferedImage.TYPE_INT_RGB),"png",out); return out.toByteArray();
    }
    @Test void initialDataIsDeclaredAndCreationIsIdempotent() {
        var first=create(); var replay=create();
        assertThat(first.id()).isEqualTo(replay.id()); assertThat(first.origin()).isEqualTo("UNKNOWN");
        assertThat(first.composition()).isEqualTo("Cotton"); assertThat(first.provenance()).isEqualTo("OWNER_DECLARED");
        assertThat(MemoryRepository.rows(holdings)).hasSize(1);
        assertThatThrownBy(()->service.create(actor(bia),piece.getId(),"create_0002")).isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);
    }
    @Test void otherOwnerAndEvenAdminCannotReadPrivatePassport() {
        var p=create(); other.setRole("ADMIN");
        assertThatThrownBy(()->service.get(actor(other),piece.getId())).isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);
        assertThatThrownBy(()->service.update(actor(bia),p.id(),new GarmentPassportService.Declaration(0,"COMPRADA","Silk","Dry clean"))).isInstanceOf(ApiException.class);
    }
    @Test void declarationsCannotSelfVerifyAndUpdatesCreateHistory() throws Exception {
        var p=create();
        var body=Json.MAPPER.readValue("{\"version\":0,\"origin\":\"COMPRADA\",\"composition\":\"Silk\",\"care\":\"Dry clean\",\"verified\":true}",GarmentPassportService.Declaration.class);
        var result=service.update(actor(ana),p.id(),body);
        assertThat(result.provenance()).isEqualTo("OWNER_DECLARED"); assertThat(result.events()).hasSize(1);
        assertThat(result.events().getFirst().kind()).isEqualTo("DECLARATION");
        assertThat(result.events().getFirst().notes()).contains("Silk"); assertThat(Json.write(result)).doesNotContain("\"verified\":true");
    }
    @Test void staleVersionAndFakeVerificationEventsAreRejected() {
        var p=create();
        assertThatThrownBy(()->service.update(actor(ana),p.id(),new GarmentPassportService.Declaration(9,"UNKNOWN",null,null))).isInstanceOf(ApiException.class).extracting("status").isEqualTo(409);
        assertThatThrownBy(()->service.addEvent(actor(ana),p.id(),new GarmentPassportService.EventCommand(0,"VERIFIED",LocalDate.now(Clock.fixed(now,ZoneOffset.UTC)),"authentic",null),"event_0001")).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.addEvent(actor(ana),p.id(),new GarmentPassportService.EventCommand(0,"CARE",LocalDate.of(2027,1,1),"future",null),"event_0002")).isInstanceOf(ApiException.class);
    }
    @Test void eventRetryDoesNotDuplicateAndCorrectionKeepsOriginal() {
        var p=create(); var command=new GarmentPassportService.EventCommand(0,"REPAIR",LocalDate.of(2026,10,1),"Original repair",null);
        var first=service.addEvent(actor(ana),p.id(),command,"event_0001");
        assertThat(service.addEvent(actor(ana),p.id(),command,"event_0001").id()).isEqualTo(first.id());
        service.addEvent(actor(ana),p.id(),new GarmentPassportService.EventCommand(0,"CORRECTION",LocalDate.of(2026,10,2),"Correct repair date",first.id()),"event_0002");
        assertThat(MemoryRepository.<PassportEvent>rows(events)).hasSize(2);
        assertThat(events.findById(first.id()).orElseThrow().getNotes()).isEqualTo("Original repair");
    }
    @Test void publicProjectionHasOnlyExplicitScopeAndNoPrivateNarrativeOrDocuments() throws Exception {
        var p=create();
        service.addEvent(actor(ana),p.id(),new GarmentPassportService.EventCommand(0,"PURCHASE",LocalDate.of(2026,10,1),"CPF 123 SECRET RECEIPT ADDRESS",null),"event_0001");
        service.uploadEvidence(actor(ana),p.id(),"PURCHASE_RECEIPT",photo(),"evidence_0001");
        var shared=service.share(actor(ana),p.id(),new GarmentPassportService.ShareCommand(0,Set.of("NAME","HISTORY"),24));
        PassportShare stored=shares.findById(shared.share().id()).orElseThrow();
        assertThat(stored.getTokenHash()).isNotEqualTo(shared.token()); assertThat(stored.getTokenHash()).hasSize(64);
        String publicJson=Json.write(service.publicView(shared.token()));
        assertThat(publicJson).contains("Jaqueta azul","PURCHASE","NOT_VERIFIED").doesNotContain("CPF","SECRET","PRIVATE","Cotton",ana.getId().toString(),"controllerId","evidence","notes","content");
        assertThat(service.publicView(shared.token())).doesNotContainKeys("origin","composition","care","owner","pieceId");
    }
    @Test void revocationExpiryAndUnapprovedShareScopeDenyPublicAccess() {
        var p=create();
        assertThatThrownBy(()->service.share(actor(ana),p.id(),new GarmentPassportService.ShareCommand(0,Set.of("EVIDENCE"),24))).isInstanceOf(ApiException.class);
        var shared=service.share(actor(ana),p.id(),new GarmentPassportService.ShareCommand(0,Set.of("ORIGIN"),24));
        service.revoke(actor(ana),p.id(),shared.share().id());
        assertThatThrownBy(()->service.publicView(shared.token())).isInstanceOf(ApiException.class).extracting("status").isEqualTo(404);
        var second=service.share(actor(ana),p.id(),new GarmentPassportService.ShareCommand(0,Set.of("ORIGIN"),24));
        shares.findById(second.share().id()).orElseThrow().setExpiresAt(now);
        assertThatThrownBy(()->service.publicView(second.token())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.publicView("../../private")).isInstanceOf(ApiException.class);
    }
    @Test void evidenceIsControllerOnlyAndDeletedContentCannotBeDownloaded() throws Exception {
        var p=create(); byte[] source=photo(); var stored=service.uploadEvidence(actor(ana),p.id(),"PURCHASE_RECEIPT",source,"evidence_0001");
        assertThat(stored.status()).isEqualTo("PRESENTED_UNVERIFIED");
        assertThat(service.uploadEvidence(actor(ana),p.id(),"PURCHASE_RECEIPT",source,"evidence_0001").id()).isEqualTo(stored.id());
        assertThat(service.downloadEvidence(actor(ana),stored.id())).isNotEmpty();
        assertThatThrownBy(()->service.downloadEvidence(actor(bia),stored.id())).isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);
        service.deleteEvidence(actor(ana),stored.id()); assertThat(evidence.findById(stored.id()).orElseThrow().getContentBase64()).isNull();
        assertThatThrownBy(()->service.downloadEvidence(actor(ana),stored.id())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.uploadEvidence(actor(ana),p.id(),"PURCHASE_RECEIPT",source,"evidence_0001")).isInstanceOf(ApiException.class);
    }
    @Test void administratorArchivingPermanentlyRevokesLinksAndCancelsPendingTransferWithoutErasingDocuments() throws Exception {
        var p=create();
        var document=service.uploadEvidence(actor(ana),p.id(),"PURCHASE_RECEIPT",photo(),"evidence_0001");
        var shared=service.share(actor(ana),p.id(),new GarmentPassportService.ShareCommand(0,Set.of("NAME"),24));
        var offered=offer(p.id(),"offer_0001");
        piece.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        other.setRole("ADMIN");
        service.onPieceDeleted(new DomainEvents.PieceDeleted(other.getId(),piece.getId()));
        assertThat(shares.findById(shared.share().id()).orElseThrow().getRevokedAt()).isEqualTo(now);
        assertThat(transfers.findById(offered.transfer().id()).orElseThrow().getStatus()).isEqualTo("CANCELLED");
        assertThat(passports.findById(p.id()).orElseThrow().getPendingTransferId()).isNull();
        assertThat(service.downloadEvidence(actor(ana),document.id())).isNotEmpty();
        piece.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        assertThatThrownBy(()->service.publicView(shared.token())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.accept(actor(bia),offered.transfer().id(),new GarmentPassportService.AcceptCommand(0,offered.token()),"accept_0001")).isInstanceOf(ApiException.class);
    }
    @Test void archivingFormerOwnersHistoricalItemDoesNotRevokeNewOwnersLinks() {
        var p=create(); var offered=offer(p.id(),"offer_0001");
        var accepted=service.accept(actor(bia),offered.transfer().id(),new GarmentPassportService.AcceptCommand(0,offered.token()),"accept_0001");
        var shared=service.share(actor(bia),p.id(),new GarmentPassportService.ShareCommand(0,Set.of("NAME"),24));
        service.onPieceDeleted(new DomainEvents.PieceDeleted(ana.getId(),piece.getId()));
        assertThat(service.publicView(shared.token())).containsEntry("pieceName",piece.getName());
        assertThat(passports.findById(p.id()).orElseThrow().getPieceId()).isEqualTo(accepted.recipientPieceId());
    }
    @Test void evidenceValidatesRealSignaturesDecodingAndLimits() {
        assertThatThrownBy(()->GarmentPassportService.safeImage("%PDF-1.4 forged-image".getBytes())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->GarmentPassportService.safeImage(new byte[]{(byte)137,80,78,71,13,10,26,10})).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->GarmentPassportService.safeImage(new byte[2*1024*1024+1])).isInstanceOf(ApiException.class);
    }
    @Test void jpegEvidenceIsReencodedAsPngWithoutTrailingPrivateContent() throws Exception {
        ByteArrayOutputStream jpeg=new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(8,8,BufferedImage.TYPE_INT_RGB),"jpeg",jpeg);
        jpeg.write("PRIVATE ORIGINAL FILE DATA".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        byte[] sanitized=GarmentPassportService.safeImage(jpeg.toByteArray());
        assertThat(Arrays.copyOf(sanitized,8)).containsExactly((byte)137,(byte)80,(byte)78,(byte)71,(byte)13,(byte)10,(byte)26,(byte)10);
        assertThat(new String(sanitized,java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("PRIVATE ORIGINAL FILE DATA");
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(sanitized)).getWidth()).isEqualTo(8);
    }
    @Test void expiredEvidenceIsUnavailableBeforeTheDailyJobAndItsPayloadIsPurged() throws Exception {
        var p=create(); var uploaded=service.uploadEvidence(actor(ana),p.id(),"CARE_LABEL",photo(),"evidence_0001");
        evidence.findById(uploaded.id()).orElseThrow().setExpiresAt(now.minusSeconds(1));
        assertThat(service.myEvidence(actor(ana),p.id()).getFirst().status()).isEqualTo("EXPIRED");
        assertThatThrownBy(()->service.downloadEvidence(actor(ana),uploaded.id())).isInstanceOf(ApiException.class);
        service.purgeExpiredEvidence();
        assertThat(evidence.findById(uploaded.id()).orElseThrow().getContentBase64()).isNull();
        assertThat(evidence.findById(uploaded.id()).orElseThrow().getContentHash()).isNull();
        assertThat(service.myEvidence(actor(ana),p.id())).isEmpty();
    }
    @Test void acceptanceIsRecipientAndTokenBound() {
        var p=create(); var offered=offer(p.id(),"offer_0001");
        assertThatThrownBy(()->service.accept(actor(other),offered.transfer().id(),new GarmentPassportService.AcceptCommand(0,offered.token()),"accept_0001")).isInstanceOf(ApiException.class).extracting("status").isEqualTo(403);
        assertThatThrownBy(()->service.accept(actor(bia),offered.transfer().id(),new GarmentPassportService.AcceptCommand(0,"x".repeat(43)),"accept_0001")).isInstanceOf(ApiException.class);
        assertThat(passports.findById(p.id()).orElseThrow().getOwnerId()).isEqualTo(ana.getId());
    }
    @Test void transferArchivesHistoricalItemPreservesDocumentsAndRevokesShares() throws Exception {
        piece.setVisibility(Visibility.PUBLIC); piece.setModerationStatus(ModerationStatus.APPROVED);
        var p=create(); var document=service.uploadEvidence(actor(ana),p.id(),"PURCHASE_RECEIPT",photo(),"evidence_0001");
        service.addEvent(actor(ana),p.id(),new GarmentPassportService.EventCommand(0,"PURCHASE",LocalDate.of(2026,10,1),"PERSONAL PRIVATE PURCHASE",null),"event_0001");
        var shared=service.share(actor(ana),p.id(),new GarmentPassportService.ShareCommand(0,Set.of("NAME"),24));
        var offered=offer(p.id(),"offer_0001");
        var accepted=service.accept(actor(bia),offered.transfer().id(),new GarmentPassportService.AcceptCommand(0,offered.token()),"accept_0001");
        assertThat(accepted.status()).isEqualTo("ACCEPTED");
        assertThat(service.accept(actor(bia),offered.transfer().id(),new GarmentPassportService.AcceptCommand(0,offered.token()),"accept_0001").recipientPieceId()).isEqualTo(accepted.recipientPieceId());
        assertThat(piece.getUser().getId()).isEqualTo(ana.getId()); assertThat(piece.getAvailabilityStatus()).isEqualTo(AvailabilityStatus.ARCHIVED);
        assertThat(piece.getVisibility()).isEqualTo(Visibility.PRIVATE);
        WardrobeItem next=pieces.findById(accepted.recipientPieceId()).orElseThrow();
        assertThat(next.getUser().getId()).isEqualTo(bia.getId()); assertThat(next.getVisibility()).isEqualTo(Visibility.PRIVATE);
        verify(lifecycle,times(1)).publishEvent(new DomainEvents.PieceDeleted(ana.getId(),piece.getId()));
        verify(lifecycle,times(1)).publishEvent(new DomainEvents.PieceCreated(bia.getId(),next.getId(),false));
        verifyNoMoreInteractions(lifecycle);
        assertThat(next.getNotes()).isNull(); assertThat(next.getPurchaseLocation()).isNull(); assertThat(next.getSealIdsJson()).isNull();
        assertThat(next.getImageUrl()).doesNotContain("ana-private-photo"); assertThat(next.getWearCount()).isZero();
        assertThat(MemoryRepository.<PassportHolding>rows(holdings).stream().filter(h->h.getActivePassportId()!=null).count()).isEqualTo(1);
        assertThat(service.get(actor(bia),next.getId()).events().getFirst().notes()).isNull();
        assertThat(service.get(actor(bia),next.getId()).evidence()).isEmpty();
        assertThat(service.downloadEvidence(actor(ana),document.id())).isNotEmpty();
        assertThatThrownBy(()->service.downloadEvidence(actor(bia),document.id())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.publicView(shared.token())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.create(actor(ana),piece.getId(),"create_0002")).isInstanceOf(ApiException.class);
    }
    @Test void expiredCancelledAndSupersededOffersCannotTransfer() {
        var p=create(); var first=offer(p.id(),"offer_0001");
        var second=offer(p.id(),"offer_0002");
        assertThatThrownBy(()->service.accept(actor(bia),first.transfer().id(),new GarmentPassportService.AcceptCommand(0,first.token()),"accept_0001")).isInstanceOf(ApiException.class);
        transfers.findById(second.transfer().id()).orElseThrow().setExpiresAt(now);
        assertThatThrownBy(()->service.accept(actor(bia),second.transfer().id(),new GarmentPassportService.AcceptCommand(0,second.token()),"accept_0002")).isInstanceOf(ApiException.class);
        var third=offer(p.id(),"offer_0003"); service.cancelTransfer(actor(ana),p.id(),third.transfer().id());
        assertThatThrownBy(()->service.accept(actor(bia),third.transfer().id(),new GarmentPassportService.AcceptCommand(0,third.token()),"accept_0003")).isInstanceOf(ApiException.class);
        assertThat(passports.findById(p.id()).orElseThrow().getOwnerId()).isEqualTo(ana.getId());
    }
    @Test void formerOwnerCanFindOnlyTheirHistoricalDocumentsWithoutReadingNewOwnersData() throws Exception {
        var p=create(); var formerDocument=service.uploadEvidence(actor(ana),p.id(),"PURCHASE_RECEIPT",photo(),"evidence_0001");
        var offered=offer(p.id(),"offer_0001");
        var accepted=service.accept(actor(bia),offered.transfer().id(),new GarmentPassportService.AcceptCommand(0,offered.token()),"accept_0001");
        service.update(actor(bia),p.id(),new GarmentPassportService.Declaration(0,"PRESENTE","NEW OWNER COMPOSITION","NEW OWNER CARE"));
        var currentDocument=service.uploadEvidence(actor(bia),p.id(),"REPAIR_RECEIPT",photo(),"evidence_0001");
        assertThatThrownBy(()->service.get(actor(ana),piece.getId())).isInstanceOf(ApiException.class).satisfies(failure->{
            ApiException error=(ApiException)failure;
            assertThat(error.code()).isEqualTo("PASSPORT_TRANSFERRED");
            assertThat(error.details()).containsExactlyEntriesOf(Map.of("passportId",p.id()));
            assertThat(Json.write(error.details())).doesNotContain("NEW OWNER",accepted.recipientPieceId().toString());
        });
        assertThat(service.myEvidence(actor(ana),p.id())).extracting(GarmentPassportService.EvidenceView::id).containsExactly(formerDocument.id());
        assertThat(service.myEvidence(actor(bia),p.id())).extracting(GarmentPassportService.EvidenceView::id).containsExactly(currentDocument.id());
        assertThat(service.myEvidence(actor(other),p.id())).isEmpty();
        assertThatThrownBy(()->service.get(actor(ana),accepted.recipientPieceId())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.get(actor(bia),piece.getId())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.downloadEvidence(actor(ana),currentDocument.id())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.downloadEvidence(actor(bia),formerDocument.id())).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.deleteEvidence(actor(other),formerDocument.id())).isInstanceOf(ApiException.class);
        service.deleteEvidence(actor(ana),formerDocument.id());
        assertThat(service.myEvidence(actor(ana),p.id())).isEmpty();
        assertThat(service.downloadEvidence(actor(bia),currentDocument.id())).isNotEmpty();
    }
    @Test void resaleUsesExistingListingStateAndCannotAdvertiseUnavailablePiece() {
        var p=create(); assertThatThrownBy(()->service.resale(actor(ana),p.id())).isInstanceOf(ApiException.class);
        piece.setForSale(true); assertThat(service.resale(actor(ana),p.id())).containsEntry("authentication","NOT_VERIFIED").containsEntry("pieceId",piece.getId());
        piece.markAvailable(false); assertThatThrownBy(()->service.resale(actor(ana),p.id())).isInstanceOf(ApiException.class);
    }
    @Test void deletingFormerOwnerErasesTheirDocumentsAndNotesWithoutChangingNewOwnership() throws Exception {
        var p=create(); var document=service.uploadEvidence(actor(ana),p.id(),"PURCHASE_RECEIPT",photo(),"evidence_0001");
        var event=service.addEvent(actor(ana),p.id(),new GarmentPassportService.EventCommand(0,"PURCHASE",LocalDate.of(2026,10,1),"PERSONAL ADDRESS",null),"event_0001");
        var offered=offer(p.id(),"offer_0001");
        var accepted=service.accept(actor(bia),offered.transfer().id(),new GarmentPassportService.AcceptCommand(0,offered.token()),"accept_0001");
        new PassportAccountDataCleanup(passports,events,evidence,shares,transfers,holdings).purge(ana.getId());
        assertThat(passports.findById(p.id()).orElseThrow().getOwnerId()).isEqualTo(bia.getId());
        assertThat(passports.findById(p.id()).orElseThrow().getPieceId()).isEqualTo(accepted.recipientPieceId());
        assertThat(evidence.findById(document.id()).orElseThrow().getContentBase64()).isNull();
        assertThat(evidence.findById(document.id()).orElseThrow().getContentHash()).isNull();
        assertThat(events.findById(event.id()).orElseThrow().getNotes()).isNull();
        assertThat(events.findById(event.id()).orElseThrow().getAuthorId()).isNotEqualTo(ana.getId());
        assertThat(service.get(actor(bia),accepted.recipientPieceId()).composition()).isEqualTo("Cotton");
    }
    @Test void deletingCurrentOwnerRevokesLinksCancelsOffersAndErasesPrivateDeclarations() {
        var p=create(); var shared=service.share(actor(ana),p.id(),new GarmentPassportService.ShareCommand(0,Set.of("CARE"),24));
        var offered=offer(p.id(),"offer_0001");
        new PassportAccountDataCleanup(passports,events,evidence,shares,transfers,holdings).purge(ana.getId());
        assertThat(passports.findById(p.id()).orElseThrow().getCare()).isNull();
        assertThat(passports.findById(p.id()).orElseThrow().getComposition()).isNull();
        assertThat(transfers.findById(offered.transfer().id()).orElseThrow().getStatus()).isEqualTo("CANCELLED");
        assertThatThrownBy(()->service.publicView(shared.token())).isInstanceOf(ApiException.class);
    }

}
