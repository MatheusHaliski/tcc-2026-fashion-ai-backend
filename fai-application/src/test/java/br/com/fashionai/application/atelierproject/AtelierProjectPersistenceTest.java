package br.com.fashionai.application.atelierproject;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.AuditableEntity;
import br.com.fashionai.domain.model.atelierproject.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.atelierproject.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.Interceptor;
import org.hibernate.type.Type;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import tools.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static br.com.fashionai.application.atelierproject.AtelierProjectViews.*;

/** Exercises real Hibernate transactions, SQL uniqueness and repository authorization queries. */
class AtelierProjectPersistenceTest {
    static SessionFactory factory;
    static final ObjectMapper JSON=new ObjectMapper();
    @BeforeAll static void open(){factory=new Configuration()
        .addAnnotatedClass(DesignProject.class).addAnnotatedClass(DesignProjectMember.class).addAnnotatedClass(DesignRevision.class)
        .addAnnotatedClass(DesignComment.class).addAnnotatedClass(DesignReview.class).addAnnotatedClass(DesignVote.class)
        .setProperty("hibernate.connection.driver_class","org.h2.Driver")
        .setProperty("hibernate.connection.url","jdbc:h2:mem:atelier;DB_CLOSE_DELAY=-1;MODE=MySQL;LOCK_TIMEOUT=10000")
        .setProperty("hibernate.hbm2ddl.auto","create-drop")
        .setProperty("hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy")
        .setProperty("hibernate.type.preferred_uuid_jdbc_type","CHAR")
        // Standalone Hibernate has no Spring auditing handler; fill timestamps before nullability checks.
        .setInterceptor(new Interceptor(){
            @Override public boolean onPersist(Object entity,Object id,Object[] state,String[] names,Type[] types){
                if(!(entity instanceof AuditableEntity audited))return false;
                var now=Instant.now();audited.markCreatedAt(now);
                for(int i=0;i<names.length;i++)if((names[i].equals("createdAt")||names[i].equals("updatedAt"))&&state[i]==null)state[i]=now;
                return true;
            }
        }).buildSessionFactory();}
    @AfterAll static void close(){if(factory!=null)factory.close();}
    static Specification specification(){return new Specification("Camisa","Reta","Algodão","Azul","Bolso","Redonda","Curta","","Dupla","Frente","Frente","Costas","Arte própria","",List.of(new Measurement("Tórax","Largura plana entre cavas",new BigDecimal("52"))));}
    static DesignProject project(UUID owner){var p=new DesignProject();p.setOwnerId(owner);p.setTitle("Projeto");p.setBrief("");p.setVisibility(Visibility.PRIVATE);p.setState(DesignProject.State.DRAFT);p.setSpecificationJson(JSON.writeValueAsString(specification()));p.setCreationKey(UUID.randomUUID().toString());p.setActivityAt(Instant.now());p.markCreatedAt(Instant.now());return p;}
    static AtelierProjectService service(EntityManager em){var factory=new JpaRepositoryFactory(em);return new AtelierProjectService(factory.getRepository(DesignProjectRepository.class),factory.getRepository(DesignProjectMemberRepository.class),factory.getRepository(DesignRevisionRepository.class),factory.getRepository(DesignCommentRepository.class),factory.getRepository(DesignReviewRepository.class),factory.getRepository(DesignVoteRepository.class),mock(UserRepository.class),mock(Guard.class),JSON,true);}
    static CurrentUser user(UUID id){return new CurrentUser(id,"ana","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);}
    static DesignProjectMember member(UUID project,UUID user,DesignProjectMember.Role role,DesignProjectMember.Status status){var m=new DesignProjectMember();m.setProjectId(project);m.setUserId(user);m.setRole(role);m.setStatus(status);m.setExpiresAt(Instant.now().plusSeconds(3600));return m;}
    static DesignRevision revision(DesignProject p,UUID author,int number){return new DesignRevision(p.getId(),null,null,author,number,p.getTitle(),p.getBrief(),p.getSpecificationJson(),UUID.randomUUID().toString(),"digest",Instant.now().plusSeconds(3600));}
    static int transaction(Consumer<EntityManager> action){try(EntityManager em=factory.createEntityManager()){em.getTransaction().begin();try{action.accept(em);em.getTransaction().commit();return 200;}catch(ApiException failure){em.getTransaction().rollback();return failure.status();}}}
    static List<Integer> simultaneously(Callable<Integer> first,Callable<Integer> second)throws Exception{
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try{var a=pool.submit(()->{ready.countDown();start.await();return first.call();});var b=pool.submit(()->{ready.countDown();start.await();return second.call();});assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue();start.countDown();return List.of(a.get(25,TimeUnit.SECONDS),b.get(25,TimeUnit.SECONDS));}finally{start.countDown();pool.shutdownNow();}
    }
    @Test void invitationDoesNotExposePrivateProjectUntilAccepted(){
        UUID owner=UUID.randomUUID(),invited=UUID.randomUUID(),id;
        try(EntityManager em=factory.createEntityManager()){
            em.getTransaction().begin();var p=project(owner);em.persist(p);id=p.getId();var m=new DesignProjectMember();m.setProjectId(id);m.setUserId(invited);m.setRole(DesignProjectMember.Role.EDITOR);m.setStatus(DesignProjectMember.Status.INVITED);m.setExpiresAt(Instant.now().plusSeconds(3600));m.markCreatedAt(Instant.now());em.persist(m);em.flush();
            var repo=new JpaRepositoryFactory(em).getRepository(DesignProjectRepository.class);
            assertThat(repo.findAccessible(invited,DesignProjectMember.Status.ACCEPTED,PageRequest.of(0,20))).isEmpty();
            m.setStatus(DesignProjectMember.Status.ACCEPTED);em.flush();assertThat(repo.findAccessible(invited,DesignProjectMember.Status.ACCEPTED,PageRequest.of(0,20))).extracting(DesignProject::getId).containsExactly(id);em.getTransaction().rollback();
        }
    }
    @Test void databaseRejectsDuplicateInterestForTheSameRevisionAndUser(){
        try(EntityManager em=factory.createEntityManager()){
            em.getTransaction().begin();UUID revision=UUID.randomUUID(),user=UUID.randomUUID(),project=UUID.randomUUID();
            for(int i=0;i<2;i++){var vote=new DesignVote();vote.setProjectId(project);vote.setRevisionId(revision);vote.setUserId(user);vote.setInterested(true);vote.markCreatedAt(Instant.now());em.persist(vote);if(i==0)em.flush();}
            assertThatThrownBy(em::flush).isInstanceOf(RuntimeException.class);em.getTransaction().rollback();
        }
    }
    @Test void simultaneousEditsWithSameVersionProduceOneConflict() throws Exception {
        UUID owner=UUID.randomUUID(),id;
        try(EntityManager em=factory.createEntityManager()){em.getTransaction().begin();var p=project(owner);em.persist(p);id=p.getId();em.getTransaction().commit();}
        var user=new CurrentUser(owner,"ana","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);
        CountDownLatch start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        Callable<Integer> edit=()->{start.await();try(EntityManager em=factory.createEntityManager()){em.getTransaction().begin();try{service(em).update(user,id,new Update(0,"Edição","",Visibility.PRIVATE,specification(),true));em.getTransaction().commit();return 200;}catch(ApiException failure){em.getTransaction().rollback();return failure.status();}}};
        try{var a=pool.submit(edit);var b=pool.submit(edit);start.countDown();assertThat(List.of(a.get(25,TimeUnit.SECONDS),b.get(25,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
            try(EntityManager em=factory.createEntityManager()){assertThat(em.find(DesignProject.class,id).getVersion()).isEqualTo(1);}
        }finally{pool.shutdownNow();}
    }
    @Test void simultaneousPublicationsCannotCreateDivergentChildrenOfTheSameRevision() throws Exception {
        UUID owner=UUID.randomUUID();var p=project(owner);transaction(em->em.persist(p));
        Callable<Integer> first=()->transaction(em->service(em).publish(user(owner),p.getId(),new Publish(0,null,null,"first",true,null)));
        Callable<Integer> second=()->transaction(em->service(em).publish(user(owner),p.getId(),new Publish(0,null,null,"second",true,null)));
        assertThat(simultaneously(first,second)).containsExactlyInAnyOrder(200,409);
        try(EntityManager em=factory.createEntityManager()){assertThat(new JpaRepositoryFactory(em).getRepository(DesignRevisionRepository.class).findByProjectIdOrderByNumberDesc(p.getId(),PageRequest.of(0,20))).hasSize(1);assertThat(em.find(DesignProject.class,p.getId()).getRevisionNumber()).isEqualTo(1);}
    }
    @Test void simultaneousRetriesOfTheSamePublicationReturnOneSnapshot() throws Exception {
        UUID owner=UUID.randomUUID();var p=project(owner);transaction(em->em.persist(p));
        var cmd=new Publish(0,null,null,"same-command",true,null);
        Callable<Integer> publish=()->transaction(em->service(em).publish(user(owner),p.getId(),cmd));
        assertThat(simultaneously(publish,publish)).containsExactly(200,200);
        try(EntityManager em=factory.createEntityManager()){assertThat(new JpaRepositoryFactory(em).getRepository(DesignRevisionRepository.class).findByProjectIdOrderByNumberDesc(p.getId(),PageRequest.of(0,20))).hasSize(1);}
    }
    @Test void simultaneousInterestRetriesProduceOneVoteAndOneCount() throws Exception {
        UUID owner=UUID.randomUUID();var p=project(owner);final UUID[] revisionId=new UUID[1];
        transaction(em->{em.persist(p);var r=revision(p,owner,1);em.persist(r);revisionId[0]=r.getId();p.setLatestRevisionId(r.getId());p.setRevisionNumber(1);p.setState(DesignProject.State.IN_REVIEW);});
        Callable<Integer> vote=()->transaction(em->service(em).vote(user(owner),p.getId(),new Vote(revisionId[0],true)));
        assertThat(simultaneously(vote,vote)).containsExactly(200,200);
        try(EntityManager em=factory.createEntityManager()){var repo=new JpaRepositoryFactory(em).getRepository(DesignVoteRepository.class);assertThat(repo.countByRevisionIdAndInterestedTrue(revisionId[0])).isEqualTo(1);assertThat(repo.findByRevisionIdAndUserId(revisionId[0],owner)).isPresent();assertThat(em.find(DesignProject.class,p.getId()).getVersion()).isEqualTo(p.getVersion());}
    }
    @Test void simultaneousReviewDecisionsCannotBothChangeTheCurrentRevision() throws Exception {
        UUID owner=UUID.randomUUID(),a=UUID.randomUUID(),b=UUID.randomUUID();var p=project(owner);final UUID[] revisionId=new UUID[1];
        transaction(em->{em.persist(p);var r=revision(p,owner,1);em.persist(r);revisionId[0]=r.getId();p.setLatestRevisionId(r.getId());p.setRevisionNumber(1);p.setState(DesignProject.State.IN_REVIEW);em.persist(member(p.getId(),a,DesignProjectMember.Role.REVIEWER,DesignProjectMember.Status.ACCEPTED));em.persist(member(p.getId(),b,DesignProjectMember.Role.REVIEWER,DesignProjectMember.Status.ACCEPTED));});
        Callable<Integer> first=()->transaction(em->service(em).review(user(a),p.getId(),new Review(p.getVersion(),revisionId[0],DesignReview.Decision.REQUEST_CHANGES,"Ajustar gola","a")));
        Callable<Integer> second=()->transaction(em->service(em).review(user(b),p.getId(),new Review(p.getVersion(),revisionId[0],DesignReview.Decision.APPROVE_SHOWCASE,"Aprovado para exposição","b")));
        assertThat(simultaneously(first,second)).containsExactlyInAnyOrder(200,409);
        try(EntityManager em=factory.createEntityManager()){var decisions=new JpaRepositoryFactory(em).getRepository(DesignReviewRepository.class).findByProjectIdAndRevisionIdOrderByCreatedAtDesc(p.getId(),revisionId[0]);assertThat(decisions).hasSize(1);assertThat(em.find(DesignProject.class,p.getId()).getState()).isEqualTo(decisions.getFirst().getDecision()==DesignReview.Decision.APPROVE_SHOWCASE?DesignProject.State.APPROVED_FOR_SHOWCASE:DesignProject.State.CHANGES_REQUESTED);}
    }
    @Test void cleanupErasesOwnedProjectsAndPseudonymizesLicensedExternalRevisions(){
        UUID deleted=UUID.randomUUID(),other=UUID.randomUUID(),ownedId,externalId,revisionId;
        try(EntityManager em=factory.createEntityManager()){
            em.getTransaction().begin();var owned=project(deleted);var external=project(other);em.persist(owned);em.persist(external);ownedId=owned.getId();externalId=external.getId();
            var r=new DesignRevision(externalId,null,null,deleted,1,"Contribuição","",JSON.writeValueAsString(specification()),"r","digest",null);r.markCreatedAt(Instant.now());ReflectionTestUtils.setField(r,"createdBy",deleted.toString());ReflectionTestUtils.setField(r,"lastModifiedBy",deleted.toString());em.persist(r);revisionId=r.getId();
            var ownedRevision=revision(owned,deleted,1);em.persist(ownedRevision);
            external.setLatestRevisionId(revisionId);external.setState(DesignProject.State.APPROVED_FOR_SHOWCASE);ReflectionTestUtils.setField(external,"lastModifiedBy",deleted.toString());
            for(var p:List.of(owned,external)){UUID revision=p==owned?ownedRevision.getId():revisionId;em.persist(new DesignComment(p.getId(),revision,deleted,"general","Remover comentário privado","comment"));em.persist(new DesignReview(p.getId(),revision,deleted,DesignReview.Decision.APPROVE_SHOWCASE,"Remover parecer privado","review"));var v=new DesignVote();v.setProjectId(p.getId());v.setRevisionId(revision);v.setUserId(deleted);v.setInterested(true);em.persist(v);}
            em.persist(new DesignComment(externalId,revisionId,other,"general","Comentário preservado","other"));
            var member=new DesignProjectMember();member.setProjectId(externalId);member.setUserId(deleted);member.setRole(DesignProjectMember.Role.EDITOR);member.setStatus(DesignProjectMember.Status.ACCEPTED);member.setExpiresAt(Instant.now());member.markCreatedAt(Instant.now());em.persist(member);em.flush();
            var repo=new JpaRepositoryFactory(em);new AtelierAccountDataCleanup(repo.getRepository(DesignProjectRepository.class),repo.getRepository(DesignProjectMemberRepository.class),repo.getRepository(DesignRevisionRepository.class),repo.getRepository(DesignCommentRepository.class),repo.getRepository(DesignReviewRepository.class),repo.getRepository(DesignVoteRepository.class)).purge(deleted);
            em.clear();assertThat(em.find(DesignProject.class,ownedId)).isNull();assertThat(em.find(DesignRevision.class,ownedRevision.getId())).isNull();
            var preserved=em.find(DesignRevision.class,revisionId);assertThat(preserved.getAuthorId()).isEqualTo(AtelierAccountDataCleanup.ANONYMOUS_AUTHOR);assertThat(preserved.getCreatedBy()).isNull();assertThat(preserved.getLastModifiedBy()).isNull();assertThat(preserved.getSpecificationJson()).isEqualTo(r.getSpecificationJson());
            var reopened=em.find(DesignProject.class,externalId);assertThat(reopened.getState()).isEqualTo(DesignProject.State.IN_REVIEW);assertThat(reopened.getLastModifiedBy()).isNull();
            for(String entity:List.of("DesignComment","DesignReview","DesignVote","DesignProjectMember"))assertThat(em.createQuery("select count(e) from "+entity+" e where e.projectId=:project",Long.class).setParameter("project",ownedId).getSingleResult()).isZero();
            assertThat(repo.getRepository(DesignProjectMemberRepository.class).findByProjectIdAndUserId(externalId,deleted)).isEmpty();assertThat(repo.getRepository(DesignVoteRepository.class).findByRevisionIdAndUserId(revisionId,deleted)).isEmpty();assertThat(repo.getRepository(DesignReviewRepository.class).findByProjectIdAndRevisionIdOrderByCreatedAtDesc(externalId,revisionId)).isEmpty();assertThat(repo.getRepository(DesignCommentRepository.class).findTop50ByProjectIdOrderByCreatedAtDesc(externalId)).extracting(DesignComment::getAuthorId).containsExactly(other);em.getTransaction().rollback();
        }
    }
}
