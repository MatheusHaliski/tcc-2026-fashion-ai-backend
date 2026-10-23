package br.com.fashionai.application.atelierproject;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.atelierproject.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.atelierproject.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import tools.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
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
        .setProperty("hibernate.type.preferred_uuid_jdbc_type","CHAR").buildSessionFactory();}
    @AfterAll static void close(){if(factory!=null)factory.close();}
    static Specification specification(){return new Specification("Camisa","Reta","Algodão","Azul","Bolso","Redonda","Curta","","Dupla","Frente","Frente","Costas","Arte própria","",List.of());}
    static DesignProject project(UUID owner){var p=new DesignProject();p.setOwnerId(owner);p.setTitle("Projeto");p.setBrief("");p.setVisibility(Visibility.PRIVATE);p.setState(DesignProject.State.DRAFT);p.setSpecificationJson(JSON.writeValueAsString(specification()));p.setCreationKey(UUID.randomUUID().toString());p.setActivityAt(Instant.now());p.markCreatedAt(Instant.now());return p;}
    static AtelierProjectService service(EntityManager em){var factory=new JpaRepositoryFactory(em);return new AtelierProjectService(factory.getRepository(DesignProjectRepository.class),factory.getRepository(DesignProjectMemberRepository.class),factory.getRepository(DesignRevisionRepository.class),factory.getRepository(DesignCommentRepository.class),factory.getRepository(DesignReviewRepository.class),factory.getRepository(DesignVoteRepository.class),mock(UserRepository.class),mock(Guard.class),JSON,true);}
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
    @Test void cleanupErasesOwnedProjectsAndPseudonymizesLicensedExternalRevisions(){
        UUID deleted=UUID.randomUUID(),other=UUID.randomUUID(),ownedId,externalId,revisionId;
        try(EntityManager em=factory.createEntityManager()){
            em.getTransaction().begin();var owned=project(deleted),external=project(other);em.persist(owned);em.persist(external);ownedId=owned.getId();externalId=external.getId();
            var r=new DesignRevision(externalId,null,null,deleted,1,"Contribuição","",JSON.writeValueAsString(specification()),"r","digest",null);r.markCreatedAt(Instant.now());em.persist(r);revisionId=r.getId();
            var member=new DesignProjectMember();member.setProjectId(externalId);member.setUserId(deleted);member.setRole(DesignProjectMember.Role.EDITOR);member.setStatus(DesignProjectMember.Status.ACCEPTED);member.setExpiresAt(Instant.now());member.markCreatedAt(Instant.now());em.persist(member);em.flush();
            var repo=new JpaRepositoryFactory(em);new AtelierAccountDataCleanup(repo.getRepository(DesignProjectRepository.class),repo.getRepository(DesignProjectMemberRepository.class),repo.getRepository(DesignRevisionRepository.class),repo.getRepository(DesignCommentRepository.class),repo.getRepository(DesignReviewRepository.class),repo.getRepository(DesignVoteRepository.class)).purge(deleted);
            em.clear();assertThat(em.find(DesignProject.class,ownedId)).isNull();assertThat(em.find(DesignProject.class,externalId)).isNotNull();assertThat(em.find(DesignRevision.class,revisionId).getAuthorId()).isEqualTo(AtelierAccountDataCleanup.ANONYMOUS_AUTHOR);assertThat(repo.getRepository(DesignProjectMemberRepository.class).findByProjectIdAndUserId(externalId,deleted)).isEmpty();em.getTransaction().rollback();
        }
    }
}
