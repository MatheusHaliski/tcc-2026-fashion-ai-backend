package br.com.fashionai.application.sourcing;

import br.com.fashionai.application.atelierproject.AtelierProjectService;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.atelierproject.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.model.sourcing.AtelierBomItem;
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

import static br.com.fashionai.application.sourcing.AtelierProductionViews.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF-PESQ-06 — aprovação de amostra e lote de produção no Atelier. */
class AtelierProductionServiceTest {
    DesignProjectRepository projects = MemoryRepository.of(DesignProjectRepository.class);
    DesignProjectMemberRepository members = MemoryRepository.of(DesignProjectMemberRepository.class);
    DesignRevisionRepository revisions = MemoryRepository.of(DesignRevisionRepository.class);
    DesignReviewRepository reviews = MemoryRepository.of(DesignReviewRepository.class);
    DesignVoteRepository votes = MemoryRepository.of(DesignVoteRepository.class);
    UserRepository users = MemoryRepository.of(UserRepository.class);
    AtelierBomItemRepository bom = MemoryRepository.of(AtelierBomItemRepository.class);
    AtelierProductionRequestRepository requests = MemoryRepository.of(AtelierProductionRequestRepository.class);
    AtelierSampleDeviationRepository deviations = MemoryRepository.of(AtelierSampleDeviationRepository.class);
    Guard guard = new Guard(mock(AuditService.class), MemoryRepository.of(FollowRepository.class));
    Clock clock = Clock.fixed(Instant.parse("2026-11-05T12:00:00Z"), ZoneOffset.UTC);
    AtelierProjectService atelier;
    AtelierProductionService service;
    User owner, producer, voter;
    DesignProject project;
    DesignRevision revision;
    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }
    User person(String name) { User u = new User(name, name, name + "@x.invalid", "h" + name, "p", ProfileType.PESSOAL); u.setStatus(AccountStatus.ACTIVE); u.setEmailVerified(true); return users.save(u); }
    long v(UUID id) { return requests.findById(id).orElseThrow().getVersion(); }

    @BeforeEach void setUp() {
        when(projects.lockById(any())).thenAnswer(inv -> projects.findById(inv.getArgument(0)));
        when(requests.lockById(any())).thenAnswer(inv -> requests.findById(inv.getArgument(0)));
        atelier = new AtelierProjectService(projects, members, revisions, MemoryRepository.of(DesignCommentRepository.class), reviews, votes, users, guard, new ObjectMapper(), true);
        service = new AtelierProductionService(atelier, projects, requests, deviations, bom, revisions, reviews, users, guard, clock);
        owner = person("ana"); producer = person("fabrica"); voter = person("fan");
        project = new DesignProject(); project.setOwnerId(owner.getId()); project.setTitle("Jaqueta"); project.setBrief("b"); project.setVisibility(Visibility.PUBLIC);
        project.setState(DesignProject.State.IN_REVIEW); project.setSpecificationJson("{\"measurements\":[]}"); project.setCreationKey("k"); project.setActivityAt(clock.instant()); projects.save(project);
        revision = new DesignRevision(project.getId(), null, null, owner.getId(), 1, "Jaqueta", "b", "{\"fabric\":\"Linho\",\"measurements\":[]}", "r1", "d", clock.instant().plusSeconds(86400)); revisions.save(revision);
        project.setLatestRevisionId(revision.getId()); project.setRevisionNumber(1); projects.save(project);
        AtelierBomItem item = new AtelierBomItem(); item.setProjectId(project.getId()); item.setRevisionId(revision.getId()); item.setAuthorId(owner.getId()); item.setKind("MATERIAL"); item.setName("Linho"); item.setUnit("m"); item.setQuantity(new BigDecimal("1.800")); item.setRequestId("b1"); bom.save(item);
    }
    void release() { reviews.save(new DesignReview(project.getId(), revision.getId(), voter.getId(), DesignReview.Decision.APPROVE_SHOWCASE, "ok", "rv1")); }
    RequestCmd cmd(String key) { return new RequestCmd(revision.getId(), "fabrica", Map.of("Tórax", "±1 cm"), null, key); }

    @Test void requestFreezesRevisionBomAndTolerancesAndNeedsAReleasedRevision() {
        assertThatThrownBy(() -> service.request(actor(owner), project.getId(), cmd("pr-00000001"))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("REVISION_NOT_RELEASED"));
        release();
        var created = service.request(actor(owner), project.getId(), cmd("pr-00000001"));
        assertThat(created).containsEntry("status", "SAMPLE_REQUESTED").containsEntry("socialInterest", "IGNORED").containsEntry("commitment", "NONE").containsEntry("currentRevision", true);
        assertThat((List<?>) created.get("bomSnapshot")).hasSize(1);
        assertThat(service.request(actor(owner), project.getId(), cmd("pr-00000001")).get("id")).isEqualTo(created.get("id"));
        AtelierBomItem extra = new AtelierBomItem(); extra.setProjectId(project.getId()); extra.setRevisionId(revision.getId()); extra.setAuthorId(owner.getId()); extra.setKind("TRIM"); extra.setName("Botão"); extra.setUnit("un"); extra.setQuantity(BigDecimal.TEN); extra.setRequestId("b2"); bom.save(extra);
        assertThat((List<?>) service.list(actor(owner), project.getId()).getFirst().get("bomSnapshot")).hasSize(1);
        assertThatThrownBy(() -> service.request(actor(voter), project.getId(), cmd("pr-00000002"))).isInstanceOf(ApiException.class);
    }

    @Test void deviationsAreAcceptedOnlyWithJustificationOrReturned() {
        release();
        UUID id = (UUID) service.request(actor(owner), project.getId(), cmd("pr-00000001")).get("id");
        service.receiveSample(actor(producer), id, new VersionCmd(v(id)));
        var recorded = service.recordDeviation(actor(producer), id, new DeviationCmd("Tórax", "52 cm", "54 cm"));
        assertThat(recorded).containsEntry("status", "DEVIATIONS_RECORDED").containsEntry("pendingDeviations", 1L);
        @SuppressWarnings("unchecked") var rows = (List<Map<String, Object>>) recorded.get("deviations");
        UUID deviationId = (UUID) rows.getFirst().get("id");
        assertThatThrownBy(() -> service.decideDeviation(actor(producer), id, deviationId, new DecisionCmd(true, "ok"))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.decideDeviation(actor(owner), id, deviationId, new DecisionCmd(true, ""))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("DEVIATION_JUSTIFICATION"));
        assertThatThrownBy(() -> service.approve(actor(owner), id, new VersionCmd(v(id)))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("PRODUCTION_PENDING_DEVIATIONS"));
        var returned = service.decideDeviation(actor(owner), id, deviationId, new DecisionCmd(false, null));
        assertThat(returned).containsEntry("status", "RETURNED");
        service.receiveSample(actor(producer), id, new VersionCmd(v(id)));
        service.recordDeviation(actor(producer), id, new DeviationCmd("Tórax", "52 cm", "52,5 cm"));
        @SuppressWarnings("unchecked") var again = (List<Map<String, Object>>) service.list(actor(owner), project.getId()).getFirst().get("deviations");
        var accepted = service.decideDeviation(actor(owner), id, (UUID) again.get(1).get("id"), new DecisionCmd(true, "Dentro da tolerância de costura"));
        assertThat(accepted).containsEntry("pendingDeviations", 0L);
    }

    @Test void approvalIsExplicitIgnoresVotesAndFallsWithANewRevision() {
        release();
        UUID id = (UUID) service.request(actor(owner), project.getId(), cmd("pr-00000001")).get("id");
        for (int i = 0; i < 3; i++) { DesignVote vote = new DesignVote(); vote.setProjectId(project.getId()); vote.setRevisionId(revision.getId()); vote.setUserId(UUID.randomUUID()); vote.setInterested(true); votes.save(vote); }
        assertThatThrownBy(() -> service.approve(actor(owner), id, new VersionCmd(v(id)))).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("PRODUCTION_TRANSITION"));
        service.receiveSample(actor(producer), id, new VersionCmd(v(id)));
        assertThatThrownBy(() -> service.approve(actor(producer), id, new VersionCmd(v(id)))).isInstanceOf(ApiException.class);
        var approved = service.approve(actor(owner), id, new VersionCmd(v(id)));
        assertThat(approved).containsEntry("status", "APPROVED").containsEntry("approvalValid", true).containsEntry("approvedBy", owner.getId()).containsEntry("approvedProjectVersion", project.getVersion());
        DesignRevision next = new DesignRevision(project.getId(), revision.getId(), null, owner.getId(), 2, "Jaqueta", "b", "{\"fabric\":\"Algodão\",\"measurements\":[]}", "r2", "d2", null); revisions.save(next);
        project.setLatestRevisionId(next.getId()); projects.save(project);
        var after = service.list(actor(owner), project.getId()).getFirst();
        assertThat(after).containsEntry("approvalValid", false).containsEntry("invalidatedByRevision", true);
        assertThat(service.producerInbox(actor(producer)).getFirst()).containsEntry("projectTitle", "Jaqueta").containsEntry("role", "PRODUCER");
        assertThat(service.producerInbox(actor(voter))).isEmpty();
    }
}
