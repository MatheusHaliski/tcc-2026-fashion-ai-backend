package br.com.fashionai.application.passport;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.model.passport.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.domain.repository.passport.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

/** Real Hibernate/JDBC coverage for encrypted documents, DB uniqueness and simultaneous acceptance. */
class PassportPersistenceTest {
    static SessionFactory factory;
    static final Instant NOW=Instant.parse("2026-10-22T12:00:00Z");
    static String previousKey;
    @BeforeAll static void open() {
        previousKey=System.getProperty("DATA_ENCRYPTION_KEY");
        if(previousKey==null&&System.getenv("DATA_ENCRYPTION_KEY")==null) System.setProperty("DATA_ENCRYPTION_KEY",Base64.getEncoder().encodeToString(new byte[32]));
        factory=new Configuration().addAnnotatedClass(GarmentPassport.class).addAnnotatedClass(PassportHolding.class)
                .addAnnotatedClass(PassportEvent.class).addAnnotatedClass(PassportShare.class).addAnnotatedClass(PassportEvidence.class).addAnnotatedClass(PassportTransfer.class)
                .setProperty("hibernate.connection.driver_class","org.h2.Driver")
                .setProperty("hibernate.connection.url","jdbc:h2:mem:passports;DB_CLOSE_DELAY=-1;MODE=MySQL;LOCK_TIMEOUT=10000")
                .setProperty("hibernate.hbm2ddl.auto","create-drop")
                .setProperty("hibernate.type.preferred_uuid_jdbc_type","CHAR").buildSessionFactory();
        // Spring normally fills timestamps in @PrePersist, before Hibernate checks non-null properties.
        // PRE_INSERT is too late: a failed insert rolls back JDBC while leaving the mocked source item archived.
        var auditing=new org.hibernate.event.spi.PersistEventListener() {
            @Override public void onPersist(org.hibernate.event.spi.PersistEvent event) {
                if(event.getObject() instanceof AuditableEntity entity) entity.markCreatedAt(NOW);
            }
            @Override public void onPersist(org.hibernate.event.spi.PersistEvent event,org.hibernate.event.spi.PersistContext context) {
                onPersist(event);
            }
        };
        var listeners=factory.unwrap(org.hibernate.engine.spi.SessionFactoryImplementor.class).getServiceRegistry()
                .getService(org.hibernate.event.service.spi.EventListenerRegistry.class);
        listeners.prependListeners(org.hibernate.event.spi.EventType.PERSIST,auditing);
        listeners.prependListeners(org.hibernate.event.spi.EventType.PERSIST_ONFLUSH,auditing);
    }
    @AfterAll static void close() {
        if(factory!=null) factory.close();
        if(previousKey==null) System.clearProperty("DATA_ENCRYPTION_KEY"); else System.setProperty("DATA_ENCRYPTION_KEY",previousKey);
    }
    static GarmentPassport passport() {
        GarmentPassport p=new GarmentPassport(); p.setPieceId(UUID.randomUUID()); p.setOwnerId(UUID.randomUUID()); p.setStateUpdatedAt(NOW); p.markCreatedAt(NOW); return p;
    }
    static PassportHolding holding(GarmentPassport p) {
        PassportHolding h=new PassportHolding(); h.setPassportId(p.getId()); h.setOwnerId(p.getOwnerId()); h.setPieceId(p.getPieceId()); h.setActivePassportId(p.getId()); h.setStartedAt(NOW); h.markCreatedAt(NOW); return h;
    }
    @Test void evidenceIsEncryptedAtRest() {
        UUID id; String payload=Base64.getEncoder().encodeToString("PRIVATE RECEIPT".getBytes());
        try(EntityManager em=factory.createEntityManager()) {
            em.getTransaction().begin(); GarmentPassport p=passport(); em.persist(p);
            PassportEvidence e=new PassportEvidence(); e.setPassportId(p.getId()); e.setControllerId(p.getOwnerId()); e.setKind("PURCHASE_RECEIPT"); e.setCommandKey("evidence_0001");
            e.setContentBase64(payload); e.setExpiresAt(NOW.plusSeconds(3600)); e.markCreatedAt(NOW); em.persist(e); em.flush(); id=e.getId();
            String raw=(String)em.createNativeQuery("select content_ciphertext from passport_evidence where id=?1",String.class).setParameter(1,id.toString()).getSingleResult();
            assertThat(raw).startsWith("enc:v1:").doesNotContain("PRIVATE RECEIPT",payload);
            em.getTransaction().commit();
        }
        try(EntityManager em=factory.createEntityManager()) { assertThat(em.find(PassportEvidence.class,id).getContentBase64()).isEqualTo(payload); }
    }
    @Test void databasePreventsTwoActiveHoldings() {
        try(EntityManager em=factory.createEntityManager()) {
            em.getTransaction().begin(); GarmentPassport p=passport(); em.persist(p); em.persist(holding(p)); em.flush();
            em.persist(holding(p)); assertThatThrownBy(em::flush).isInstanceOf(RuntimeException.class);
            em.getTransaction().rollback();
        }
    }
    @Test void purgingFormerOwnerRemovesStoredCiphertextAndPreservesCurrentOwnersData() {
        UUID formerOwner=UUID.randomUUID(),currentOwner=UUID.randomUUID(),passportId,evidenceId,oldShareId,currentShareId;
        try(EntityManager em=factory.createEntityManager()) {
            em.getTransaction().begin(); GarmentPassport p=passport(); p.setOwnerId(currentOwner); p.setComposition("Cotton"); p.setCare("Cold wash");
            em.persist(p); passportId=p.getId();
            PassportEvidence document=new PassportEvidence(); document.setPassportId(p.getId()); document.setControllerId(formerOwner);
            document.setKind("PURCHASE_RECEIPT"); document.setCommandKey("evidence_0001"); document.setContentBase64("PRIVATE FORMER OWNER RECEIPT");
            document.setContentHash("f".repeat(64)); document.setExpiresAt(NOW.plusSeconds(3600)); em.persist(document); evidenceId=document.getId();
            PassportEvent event=new PassportEvent(); event.setPassportId(p.getId()); event.setAuthorId(formerOwner); event.setKind("PURCHASE");
            event.setOccurredOn(LocalDate.of(2026,10,1)); event.setCommandKey("event_0001"); event.setNotes("PRIVATE FORMER OWNER ADDRESS"); em.persist(event);
            PassportShare oldShare=new PassportShare(); oldShare.setPassportId(p.getId()); oldShare.setOwnerId(formerOwner);
            oldShare.setTokenHash(GarmentPassportService.hash(UUID.randomUUID().toString())); oldShare.setFields("NAME"); oldShare.setExpiresAt(NOW.plusSeconds(3600)); em.persist(oldShare); oldShareId=oldShare.getId();
            PassportShare currentShare=new PassportShare(); currentShare.setPassportId(p.getId()); currentShare.setOwnerId(currentOwner);
            currentShare.setTokenHash(GarmentPassportService.hash(UUID.randomUUID().toString())); currentShare.setFields("CARE"); currentShare.setExpiresAt(NOW.plusSeconds(3600)); em.persist(currentShare); currentShareId=currentShare.getId();
            PassportHolding former=holding(p); former.setOwnerId(formerOwner); former.setActivePassportId(null); former.setEndedAt(NOW); em.persist(former);
            em.persist(holding(p)); em.getTransaction().commit();
        }
        try(EntityManager em=factory.createEntityManager()) {
            em.getTransaction().begin(); JpaRepositoryFactory repos=new JpaRepositoryFactory(em);
            new PassportAccountDataCleanup(repos.getRepository(GarmentPassportRepository.class),repos.getRepository(PassportEventRepository.class),
                    repos.getRepository(PassportEvidenceRepository.class),repos.getRepository(PassportShareRepository.class),
                    repos.getRepository(PassportTransferRepository.class),repos.getRepository(PassportHoldingRepository.class)).purge(formerOwner);
            em.flush();
            assertThat(em.createNativeQuery("select content_ciphertext from passport_evidence where id=?1",String.class)
                    .setParameter(1,evidenceId.toString()).getSingleResult()).isNull();
            assertThat(em.find(PassportEvidence.class,evidenceId).getContentHash()).isNull();
            assertThat(em.find(PassportShare.class,oldShareId).getRevokedAt()).isNotNull();
            assertThat(em.find(PassportShare.class,currentShareId).getRevokedAt()).isNull();
            assertThat(em.find(PassportShare.class,currentShareId).getOwnerId()).isEqualTo(currentOwner);
            assertThat(em.find(GarmentPassport.class,passportId).getOwnerId()).isEqualTo(currentOwner);
            assertThat(em.find(GarmentPassport.class,passportId).getComposition()).isEqualTo("Cotton");
            assertThat(em.find(GarmentPassport.class,passportId).getCare()).isEqualTo("Cold wash");
            assertThat(repos.getRepository(PassportEventRepository.class).findByAuthorId(formerOwner)).isEmpty();
            assertThat(repos.getRepository(PassportHoldingRepository.class).findByActivePassportId(passportId).orElseThrow().getOwnerId()).isEqualTo(currentOwner);
            em.getTransaction().commit();
        }
    }
    @Test void simultaneousAcceptRetriesCreateExactlyOneRecipientPieceAndHolding() throws Exception {
        UUID passportId,transferId; User sender=new User(),recipient=new User(); sender.assignId(UUID.randomUUID()); recipient.assignId(UUID.randomUUID());
        sender.setStatus(AccountStatus.ACTIVE); recipient.setStatus(AccountStatus.ACTIVE); recipient.setEmailVerified(true);
        WardrobeItem original=new WardrobeItem(); original.assignId(UUID.randomUUID()); original.setUser(sender); original.setName("Jacket"); original.setCategory("upper_piece"); original.setSubcategory("jacket"); original.setMaterial("cotton"); original.setColor("blue"); original.setImageUrl("/private.jpg");
        String token="a".repeat(43);
        try(EntityManager em=factory.createEntityManager()) {
            em.getTransaction().begin(); GarmentPassport p=passport(); p.setOwnerId(sender.getId()); p.setPieceId(original.getId()); em.persist(p); em.persist(holding(p));
            PassportTransfer transfer=new PassportTransfer(); transfer.setPassportId(p.getId()); transfer.setFromOwnerId(sender.getId()); transfer.setRecipientId(recipient.getId()); transfer.setSourcePieceId(original.getId());
            transfer.setTokenHash(GarmentPassportService.hash(token)); transfer.setStatus("PENDING"); transfer.setCommandKey("offer_0001"); transfer.setExpiresAt(NOW.plusSeconds(3600)); transfer.markCreatedAt(NOW); em.persist(transfer); em.flush();
            p.setPendingTransferId(transfer.getId()); passportId=p.getId(); transferId=transfer.getId(); em.getTransaction().commit();
        }
        WardrobeItemRepository pieces=mock(WardrobeItemRepository.class); UserRepository users=mock(UserRepository.class); Guard guard=mock(Guard.class);
        when(pieces.findForSealRequest(original.getId())).thenReturn(Optional.of(original)); AtomicInteger created=new AtomicInteger();
        when(pieces.save(any())).thenAnswer(call->call.getArgument(0));
        when(pieces.saveAndFlush(any())).thenAnswer(call->{ WardrobeItem item=call.getArgument(0); item.assignId(UUID.randomUUID()); created.incrementAndGet(); return item; });
        when(users.findById(sender.getId())).thenReturn(Optional.of(sender)); when(users.findById(recipient.getId())).thenReturn(Optional.of(recipient));
        CountDownLatch start=new CountDownLatch(1); ExecutorService pool=Executors.newFixedThreadPool(2);
        Callable<GarmentPassportService.TransferView> accept=()->{
            start.await(); try(EntityManager em=factory.createEntityManager()) {
                em.getTransaction().begin(); JpaRepositoryFactory repos=new JpaRepositoryFactory(em);
                GarmentPassportService service=new GarmentPassportService(repos.getRepository(GarmentPassportRepository.class),repos.getRepository(PassportHoldingRepository.class),repos.getRepository(PassportEventRepository.class),repos.getRepository(PassportShareRepository.class),repos.getRepository(PassportEvidenceRepository.class),repos.getRepository(PassportTransferRepository.class),pieces,users,guard,mock(org.springframework.context.ApplicationEventPublisher.class),true,Clock.fixed(NOW,ZoneOffset.UTC));
                var result=service.accept(CurrentUser.of(recipient,"127.0.0.1","test"),transferId,new GarmentPassportService.AcceptCommand(0,token),"accept_0001");
                em.getTransaction().commit(); return result;
            }
        };
        try {
            Future<GarmentPassportService.TransferView> a=pool.submit(accept),b=pool.submit(accept); start.countDown();
            // Observe both attempts so an audit/insert error cannot be masked by the other attempt's item check.
            var results=new ArrayList<GarmentPassportService.TransferView>(); var failures=new ArrayList<Throwable>();
            for(var attempt:List.of(a,b)) {
                try { results.add(attempt.get(20,TimeUnit.SECONDS)); }
                catch(ExecutionException ex) { failures.add(ex.getCause()); }
            }
            assertThat(failures).as("both simultaneous accept transactions must commit").isEmpty();
            assertThat(results).hasSize(2); var first=results.get(0); var second=results.get(1);
            assertThat(first.recipientPieceId()).isEqualTo(second.recipientPieceId()); assertThat(created.get()).isEqualTo(1);
            try(EntityManager em=factory.createEntityManager()) {
                assertThat(em.createQuery("select count(h) from PassportHolding h where h.activePassportId=:id",Long.class).setParameter("id",passportId).getSingleResult()).isEqualTo(1);
                assertThat(em.find(GarmentPassport.class,passportId).getOwnerId()).isEqualTo(recipient.getId());
            }
        } finally { pool.shutdownNow(); }
    }
}
