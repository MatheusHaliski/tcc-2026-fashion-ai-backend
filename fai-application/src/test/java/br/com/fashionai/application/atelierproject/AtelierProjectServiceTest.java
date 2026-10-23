package br.com.fashionai.application.atelierproject;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.atelierproject.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.domain.repository.atelierproject.*;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static br.com.fashionai.application.atelierproject.AtelierProjectViews.*;
import static br.com.fashionai.domain.model.atelierproject.DesignProjectMember.Role.*;
import static br.com.fashionai.domain.model.atelierproject.DesignProjectMember.Status.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AtelierProjectServiceTest {
    DesignProjectRepository projects=mock(DesignProjectRepository.class);
    DesignProjectMemberRepository members=mock(DesignProjectMemberRepository.class);
    DesignRevisionRepository revisions=mock(DesignRevisionRepository.class);
    DesignCommentRepository comments=mock(DesignCommentRepository.class);
    DesignReviewRepository reviews=mock(DesignReviewRepository.class);
    DesignVoteRepository votes=mock(DesignVoteRepository.class);
    UserRepository users=mock(UserRepository.class);
    FollowRepository follows=mock(FollowRepository.class);
    Guard guard=new Guard(mock(AuditService.class),follows);
    ObjectMapper json=new ObjectMapper();
    AtelierProjectService service=new AtelierProjectService(projects,members,revisions,comments,reviews,votes,users,guard,json,true);
    UUID owner=UUID.randomUUID(), projectId=UUID.randomUUID();
    CurrentUser user=new CurrentUser(owner,"ana","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);
    DesignProject project;Map<UUID,DesignRevision> snapshots=new HashMap<>();
    Specification specification(String fabric){return new Specification("Camiseta","Reta",fabric,"Azul","Um bolso","Redonda","Curta","Sem fecho","Costura dupla","Frente 12cm","Frente","Costas","Arte própria","",List.of(new Measurement("Tórax","Largura plana entre cavas",new BigDecimal("52"))));}
    @BeforeEach void setup(){
        project=new DesignProject();project.assignId(projectId);project.setOwnerId(owner);project.setTitle("Peça coletiva");project.setBrief("Briefing");project.setVisibility(Visibility.PRIVATE);project.setState(DesignProject.State.DRAFT);project.setSpecificationJson(json.writeValueAsString(specification("Algodão")));project.markCreatedAt(Instant.now());
        when(projects.lockById(projectId)).thenReturn(Optional.of(project));when(projects.findById(projectId)).thenReturn(Optional.of(project));
        when(projects.saveAndFlush(any())).thenAnswer(i->{DesignProject p=i.getArgument(0);if(p.getId()==null)p.assignId(projectId);ReflectionTestUtils.setField(p,"version",p.getVersion()+1);return p;});
        when(revisions.saveAndFlush(any())).thenAnswer(i->{DesignRevision r=i.getArgument(0);r.assignId(UUID.randomUUID());r.markCreatedAt(Instant.now());snapshots.put(r.getId(),r);return r;});
        when(revisions.findById(any())).thenAnswer(i->Optional.ofNullable(snapshots.get(i.getArgument(0))));
    }
    CurrentUser other(){return new CurrentUser(UUID.randomUUID(),"bia","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);}
    void accepted(CurrentUser actor,DesignProjectMember.Role role){var member=new DesignProjectMember();member.setProjectId(projectId);member.setUserId(actor.id());member.setRole(role);member.setStatus(ACCEPTED);when(members.findByProjectIdAndUserId(projectId,actor.id())).thenReturn(Optional.of(member));}
    ApiException error(Runnable runnable,int status){var e=org.junit.jupiter.api.Assertions.assertThrows(ApiException.class,runnable::run);assertThat(e).isNotNull();assertThat(e.status()).isEqualTo(status);return e;}
    Publish publish(long version,String key,UUID parent){return new Publish(version,parent,null,key,true,Instant.now().plus(Duration.ofDays(2)));}
    @Test void rejectsPrivateAccessIncludingExportWithoutAcceptedMembership(){var stranger=other();error(()->service.get(stranger,projectId),403);error(()->service.techPack(stranger,projectId,UUID.randomUUID()),403);verifyNoInteractions(revisions,votes);}
    @Test void publicVisibilityDoesNotGrantEditOrCommentPrivileges(){var stranger=other();project.setVisibility(Visibility.PUBLIC);assertThat(service.get(stranger,projectId).capabilities().edit()).isFalse();error(()->service.update(stranger,projectId,new Update(0,"Ataque","",Visibility.PUBLIC,specification("Outra"),true)),403);error(()->service.comment(stranger,projectId,new Comment(0,UUID.randomUUID(),"general","Ataque","c1")),403);}
    @Test void staleVersionCannotOverwriteDraft(){ReflectionTestUtils.setField(project,"version",7L);error(()->service.update(user,projectId,new Update(6,"Perdido","",Visibility.PRIVATE,specification("Outro"),true)),409);assertThat(project.getTitle()).isEqualTo("Peça coletiva");verify(projects,never()).saveAndFlush(any());}
    @Test void publishingPreservesSnapshotAfterLaterDraftChanges(){var result=service.publish(user,projectId,publish(0,"revision-1",null));var immutable=snapshots.get(result.latestRevision().id());assertThat(result.latestRevision().specification().fabric()).isEqualTo("Algodão");service.update(user,projectId,new Update(project.getVersion(),"Nova peça","",Visibility.PRIVATE,specification("Linho"),true));assertThat(json.readValue(immutable.getSpecificationJson(),Specification.class).fabric()).isEqualTo("Algodão");assertThat(project.getState()).isEqualTo(DesignProject.State.DRAFT);}
    @Test void divergentParentAndMissingLicenseAreRejected(){error(()->service.publish(user,projectId,publish(0,"r",UUID.randomUUID())),409);error(()->service.publish(user,projectId,new Publish(0,null,null,"r",false,null)),400);verify(revisions,never()).saveAndFlush(any());}
    @Test void retryOfPublishedRevisionDoesNotCreateAnotherSnapshot(){var cmd=publish(0,"r1",null);var result=service.publish(user,projectId,cmd);var stored=snapshots.get(result.latestRevision().id());when(revisions.findByProjectIdAndRequestId(projectId,"r1")).thenReturn(Optional.of(stored));service.publish(user,projectId,cmd);assertThat(project.getRevisionNumber()).isEqualTo(1);verify(revisions,times(1)).saveAndFlush(any());}
    @Test void revokedEditorCannotWriteAndBlockingOverridesMembership(){var editor=other();accepted(editor,EDITOR);members.findByProjectIdAndUserId(projectId,editor.id()).orElseThrow().setStatus(REVOKED);error(()->service.update(editor,projectId,new Update(0,"x","",Visibility.PRIVATE,specification("x"),true)),403);
        accepted(editor,EDITOR);var block=new Follow();block.setStatus(FollowStatus.BLOQUEADO);when(follows.findByFollowerIdAndFollowingId(editor.id(),owner)).thenReturn(Optional.of(block));error(()->service.get(editor,projectId),403);
    }
    @Test void onlyInvitedUserAcceptsAndExpiredInviteDoesNotGrantAccess(){var invited=other();var member=new DesignProjectMember();member.assignId(UUID.randomUUID());member.setProjectId(projectId);member.setUserId(invited.id());member.setRole(EDITOR);member.setStatus(INVITED);member.setExpiresAt(Instant.now().minusSeconds(1));when(members.findById(member.getId())).thenReturn(Optional.of(member));error(()->service.accept(user,projectId,member.getId()),404);error(()->service.accept(invited,projectId,member.getId()),409);assertThat(member.getStatus()).isEqualTo(INVITED);verify(members,never()).saveAndFlush(any());}
    @Test void interestIsUniquePerUserAndRevisionAndDoesNotTouchProjectState(){var result=service.publish(user,projectId,publish(0,"r1",null));var revisionId=result.latestRevision().id();var vote=new DesignVote();vote.assignId(UUID.randomUUID());vote.setRevisionId(revisionId);vote.setUserId(owner);vote.setProjectId(projectId);when(votes.findByRevisionIdAndUserId(revisionId,owner)).thenReturn(Optional.of(vote));service.vote(user,projectId,new Vote(revisionId,true));service.vote(user,projectId,new Vote(revisionId,false));verify(votes,times(2)).saveAndFlush(vote);assertThat(vote.isInterested()).isFalse();assertThat(project.getState()).isEqualTo(DesignProject.State.IN_REVIEW);}
    @Test void noVoteAfterDeadlineAndNoExportClaimOfProductionApproval(){var published=service.publish(user,projectId,publish(0,"r1",null));var r=snapshots.get(published.latestRevision().id());ReflectionTestUtils.setField(r,"votingEndsAt",Instant.EPOCH);error(()->service.vote(user,projectId,new Vote(r.getId(),true)),409);var pack=service.techPack(user,projectId,r.getId());assertThat(pack.productionApproved()).isFalse();assertThat(pack.reviewStatus()).isEqualTo("DRAFT");verify(votes,never()).saveAndFlush(any());}
    @Test void accountCreationPolicyAndRightsAreEnforced(){var pending=new CurrentUser(owner,"ana","USER",ProfileType.PESSOAL,false,AccountStatus.PENDING_EMAIL_VERIFICATION,null,null);error(()->service.create(pending,new Create("k","Projeto","",Visibility.PRIVATE,specification("Tecido"),true)),403);error(()->service.create(user,new Create("k","Projeto","",Visibility.PRIVATE,specification("Tecido"),false)),400);verify(projects,never()).saveAndFlush(any());}
    @Test void authorCannotSelfApproveEvenWithReviewerRole(){var editor=other();accepted(editor,EDITOR);service.publish(editor,projectId,publish(0,"r1",null));accepted(editor,REVIEWER);error(()->service.review(editor,projectId,new Review(project.getVersion(),project.getLatestRevisionId(),DesignReview.Decision.APPROVE_SHOWCASE,"Aprovado","self")),403);verify(reviews,never()).saveAndFlush(any());}
    @Test void creationIdempotencyDoesNotSilentlyKeepAnOldVisibility(){project.setVisibility(Visibility.PUBLIC);when(projects.findByOwnerIdAndCreationKey(owner,"same-key")).thenReturn(Optional.of(project));error(()->service.create(user,new Create("same-key",project.getTitle(),project.getBrief(),Visibility.PRIVATE,specification("Algodão"),true)),409);verify(projects,never()).saveAndFlush(any());}
    @Test void historicalReviewStatusSurvivesFiftyNewerProjectReviews(){var published=service.publish(user,projectId,publish(0,"r1",null));var id=published.latestRevision().id();var approved=new DesignReview(projectId,id,UUID.randomUUID(),DesignReview.Decision.APPROVE_SHOWCASE,"Exposição aprovada","old");approved.assignId(UUID.randomUUID());var newer=new ArrayList<DesignReview>();for(int i=0;i<50;i++)newer.add(new DesignReview(projectId,UUID.randomUUID(),owner,DesignReview.Decision.REQUEST_CHANGES,"Outra revisão","n"+i));when(reviews.findTop50ByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(newer);when(reviews.findByProjectIdAndRevisionIdOrderByCreatedAtDesc(projectId,id)).thenReturn(List.of(approved));assertThat(service.techPack(user,projectId,id).reviewStatus()).isEqualTo("REVIEWED_FOR_SHOWCASE");verify(reviews).findByProjectIdAndRevisionIdOrderByCreatedAtDesc(projectId,id);}
    @Test void nullMeasurementCannotBeApprovedForShowcase(){var original=specification("Algodão");var corrupt=new Specification(original.family(),original.modeling(),original.fabric(),original.colors(),original.pockets(),original.collar(),original.sleeves(),original.fastenings(),original.finishes(),original.printPlacement(),original.frontView(),original.backView(),original.referenceNotes(),original.notes(),Arrays.asList((Measurement)null));project.setSpecificationJson(json.writeValueAsString(corrupt));service.publish(user,projectId,publish(0,"r1",null));var reviewer=other();accepted(reviewer,REVIEWER);error(()->service.review(reviewer,projectId,new Review(project.getVersion(),project.getLatestRevisionId(),DesignReview.Decision.APPROVE_SHOWCASE,"Parecer","review")),400);verify(reviews,never()).saveAndFlush(any());}

    @Test void deletedOwnerCannotKeepAnOtherwisePublicProjectReadable(){project.setVisibility(Visibility.PUBLIC);var deleted=new User();deleted.assignId(owner);deleted.setStatus(AccountStatus.DELETED);when(users.findById(owner)).thenReturn(Optional.of(deleted));error(()->service.get(other(),projectId),404);}

}
