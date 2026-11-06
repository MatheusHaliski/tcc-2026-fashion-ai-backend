package br.com.fashionai.application.sourcing;

import br.com.fashionai.application.atelierproject.AtelierProjectService;
import br.com.fashionai.application.atelierproject.AtelierProjectViews;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.atelierproject.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.atelierproject.*;
import br.com.fashionai.domain.repository.sourcing.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

import static br.com.fashionai.application.sourcing.AtelierSourcingViews.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF-PESQ-04 — BOM e cotação vinculadas à revisão imutável. */
class AtelierSourcingServiceTest {
    DesignProjectRepository projects = MemoryRepository.of(DesignProjectRepository.class);
    DesignProjectMemberRepository members = MemoryRepository.of(DesignProjectMemberRepository.class);
    DesignRevisionRepository revisions = MemoryRepository.of(DesignRevisionRepository.class);
    DesignReviewRepository reviews = MemoryRepository.of(DesignReviewRepository.class);
    UserRepository users = MemoryRepository.of(UserRepository.class);
    AtelierBomItemRepository bom = MemoryRepository.of(AtelierBomItemRepository.class);
    AtelierQuoteRequestRepository requests = MemoryRepository.of(AtelierQuoteRequestRepository.class);
    AtelierQuoteRepository quotes = MemoryRepository.of(AtelierQuoteRepository.class);
    Guard guard = new Guard(mock(AuditService.class), MemoryRepository.of(FollowRepository.class));
    Clock clock = Clock.fixed(Instant.parse("2026-11-05T12:00:00Z"), ZoneOffset.UTC);
    AtelierProjectService atelier;
    AtelierSourcingService service;
    User owner, supplier, stranger;
    DesignProject project;
    DesignRevision revision;
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }
    User person(String name) { User u = new User(name, name, name + "@x.invalid", "h" + name, "p", ProfileType.PESSOAL); u.setStatus(AccountStatus.ACTIVE); u.setEmailVerified(true); return users.save(u); }

    @BeforeEach void setUp() {
        when(projects.lockById(any())).thenAnswer(inv -> projects.findById(inv.getArgument(0)));
        when(requests.lockById(any())).thenAnswer(inv -> requests.findById(inv.getArgument(0)));
        ObjectMapper json = new ObjectMapper();
        atelier = new AtelierProjectService(projects, members, revisions, MemoryRepository.of(DesignCommentRepository.class), reviews, MemoryRepository.of(DesignVoteRepository.class), users, guard, json, true);
        service = new AtelierSourcingService(atelier, bom, requests, quotes, revisions, reviews, users, guard, clock);
        owner = person("ana"); supplier = person("oficina"); stranger = person("bia");
        project = new DesignProject(); project.setOwnerId(owner.getId()); project.setTitle("Jaqueta"); project.setBrief("b"); project.setVisibility(Visibility.PRIVATE);
        project.setState(DesignProject.State.IN_REVIEW); project.setSpecificationJson("{\"measurements\":[]}"); project.setCreationKey("k"); project.setActivityAt(clock.instant()); projects.save(project);
        revision = new DesignRevision(project.getId(), null, null, owner.getId(), 1, "Jaqueta", "b", "{\"fabric\":\"Linho\",\"measurements\":[]}", "r1", "d", null); revisions.save(revision);
        project.setLatestRevisionId(revision.getId()); project.setRevisionNumber(1); projects.save(project);
    }
    void release(DesignRevision r) { reviews.save(new DesignReview(project.getId(), r.getId(), stranger.getId(), DesignReview.Decision.APPROVE_SHOWCASE, "ok", "rv-" + r.getId())); }
    QuoteRequestCmd ask(DesignRevision r, String key) { return new QuoteRequestCmd(r.getId(), "oficina", "BRL", Map.of("M", 10, "G", 5), null, key); }
    QuoteCmd quoteCmd(String key) { return new QuoteCmd(new BigDecimal("120.00"), new BigDecimal("300.00"), "BRL", 30, LocalDate.of(2026, 12, 1), "ok", key); }

    @Test void bomBelongsToAnImmutableRevisionAndEditorsOnlyWrite() {
        var item = service.addBomItem(actor(owner), project.getId(), new BomItemCmd(revision.getId(), "MATERIAL", "Linho cru", "m", new BigDecimal("1.800"), null, "bom-00000001"));
        assertThat(service.addBomItem(actor(owner), project.getId(), new BomItemCmd(revision.getId(), "MATERIAL", "Linho cru", "m", new BigDecimal("1.800"), null, "bom-00000001")).get("id")).isEqualTo(item.get("id"));
        assertThatThrownBy(() -> service.addBomItem(actor(stranger), project.getId(), new BomItemCmd(revision.getId(), "TRIM", "Botão", "un", BigDecimal.ONE, null, "bom-00000002"))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.addBomItem(actor(owner), project.getId(), new BomItemCmd(revision.getId(), "MATERIAL", "Zero", "m", BigDecimal.ZERO, null, "bom-00000003"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("BOM_INVALID"));
        assertThat(service.bom(actor(owner), project.getId(), revision.getId())).hasSize(1);
        assertThatThrownBy(() -> service.bom(actor(stranger), project.getId(), revision.getId())).isInstanceOf(ApiException.class);
    }

    @Test void quoteNeedsAReleasedRevisionAndCarriesSizesCurrencyPriceSampleValidityAndLeadTime() {
        assertThatThrownBy(() -> service.requestQuote(actor(owner), project.getId(), ask(revision, "qr-00000001"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("REVISION_NOT_RELEASED"));
        release(revision);
        var request = service.requestQuote(actor(owner), project.getId(), ask(revision, "qr-00000001"));
        assertThat(request).containsEntry("totalUnits", 15).containsEntry("currency", "BRL").containsEntry("outdated", false).containsEntry("commitment", "NONE").containsEntry("revisionNumber", 1);
        assertThat(service.requestQuote(actor(owner), project.getId(), ask(revision, "qr-00000001")).get("id")).isEqualTo(request.get("id"));
        UUID requestId = (UUID) request.get("id");
        assertThatThrownBy(() -> service.submitQuote(actor(stranger), requestId, quoteCmd("q-00000001"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(403));
        assertThatThrownBy(() -> service.submitQuote(actor(supplier), requestId, new QuoteCmd(new BigDecimal("1"), BigDecimal.ONE, "USD", 10, LocalDate.of(2026, 12, 1), null, "q-00000001"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("QUOTE_INVALID"));
        var quote = service.submitQuote(actor(supplier), requestId, quoteCmd("q-00000001"));
        assertThat(quote).containsEntry("unitPrice", new BigDecimal("120.00")).containsEntry("sampleCost", new BigDecimal("300.00")).containsEntry("leadTimeDays", 30).containsEntry("validUntil", LocalDate.of(2026, 12, 1)).containsEntry("expired", false);
        assertThat(service.submitQuote(actor(supplier), requestId, quoteCmd("q-00000001")).get("id")).isEqualTo(quote.get("id"));
        assertThat(MemoryRepository.rows(quotes)).hasSize(1);
    }

    @Test void supplierSeesOnlyGrantedItemsAndPricesStayWithOwnerAndSupplier() {
        release(revision);
        service.addBomItem(actor(owner), project.getId(), new BomItemCmd(revision.getId(), "MATERIAL", "Linho cru", "m", new BigDecimal("1.800"), null, "bom-00000001"));
        var request = service.requestQuote(actor(owner), project.getId(), ask(revision, "qr-00000001"));
        UUID requestId = (UUID) request.get("id");
        assertThat(service.supplierInbox(actor(stranger))).isEmpty();
        var inbox = service.supplierInbox(actor(supplier));
        assertThat(inbox).hasSize(1);
        assertThat(inbox.getFirst()).containsEntry("projectTitle", "Jaqueta").doesNotContainKeys("comments", "members", "votes");
        assertThat((List<?>) inbox.getFirst().get("bom")).hasSize(1);
        assertThat(service.bom(actor(supplier), project.getId(), revision.getId())).hasSize(1);
        assertThatThrownBy(() -> atelier.get(actor(supplier), project.getId())).isInstanceOf(ApiException.class);
        service.submitQuote(actor(supplier), requestId, quoteCmd("q-00000001"));
        DesignProjectMember viewer = new DesignProjectMember(); viewer.setProjectId(project.getId()); viewer.setUserId(stranger.getId()); viewer.setRole(DesignProjectMember.Role.VIEWER); viewer.setStatus(DesignProjectMember.Status.ACCEPTED); viewer.setExpiresAt(clock.instant().plusSeconds(3600)); members.save(viewer);
        @SuppressWarnings("unchecked") var viewerQuotes = (List<Map<String, Object>>) service.requests(actor(stranger), project.getId()).getFirst().get("quotes");
        assertThat(viewerQuotes.getFirst()).doesNotContainKeys("unitPrice", "sampleCost").containsKey("leadTimeDays");
        @SuppressWarnings("unchecked") var ownerQuotes = (List<Map<String, Object>>) service.requests(actor(owner), project.getId()).getFirst().get("quotes");
        assertThat(ownerQuotes.getFirst()).containsKey("unitPrice");
    }

    @Test void newRevisionMarksQuoteOutdatedAndAcceptanceRecordsAuthorAndVersion() {
        release(revision);
        var request = service.requestQuote(actor(owner), project.getId(), ask(revision, "qr-00000001"));
        UUID requestId = (UUID) request.get("id");
        var quote = service.submitQuote(actor(supplier), requestId, quoteCmd("q-00000001"));
        UUID quoteId = (UUID) quote.get("id");
        assertThatThrownBy(() -> service.acceptQuote(actor(supplier), project.getId(), quoteId, new AcceptCmd(0))).isInstanceOf(ApiException.class);
        DesignRevision next = new DesignRevision(project.getId(), revision.getId(), null, owner.getId(), 2, "Jaqueta", "b", "{\"fabric\":\"Algodão\",\"measurements\":[]}", "r2", "d2", null); revisions.save(next);
        project.setLatestRevisionId(next.getId()); project.setRevisionNumber(2); projects.save(project);
        assertThat(service.requests(actor(owner), project.getId()).getFirst()).containsEntry("outdated", true);
        assertThatThrownBy(() -> service.acceptQuote(actor(owner), project.getId(), quoteId, new AcceptCmd(0))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("QUOTE_OUTDATED"));
        project.setLatestRevisionId(revision.getId()); projects.save(project);
        var accepted = service.acceptQuote(actor(owner), project.getId(), quoteId, new AcceptCmd(0));
        assertThat(accepted).containsEntry("status", "ACCEPTED").containsEntry("acceptedBy", owner.getId()).containsEntry("acceptedRevisionId", revision.getId()).containsEntry("acceptedProjectVersion", project.getVersion());
        assertThat(service.acceptQuote(actor(owner), project.getId(), quoteId, new AcceptCmd(0))).containsEntry("status", "ACCEPTED");
        assertThat(requests.findById(requestId).orElseThrow().getStatus()).isEqualTo("ACCEPTED");
        assertThat(service.requests(actor(owner), project.getId()).getFirst()).containsEntry("commitment", "NONE");
    }
}
